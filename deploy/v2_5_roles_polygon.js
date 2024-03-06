// run: npx hardhat deploy --network mumbai --tags v2_5_roles_polygon
// env variables required:
// SERVICE_WALLETS - comma separated list of service wallets addresses
// or
// SERVICE_WALLETS_MNEMONIC - a mnemonic used to derive service wallet addresses

// script is built for hardhat-deploy plugin:
// A Hardhat Plugin For Replicable Deployments And Easy Testing
// https://www.npmjs.com/package/hardhat-deploy

// BN utils
const {
	toBN,
	print_amt,
} = require("../scripts/include/bn_utils");

// ACL token features and roles
const {
	ROLE_TOKEN_CREATOR,
	ROLE_FACTORY_MINTER,
} = require("../scripts/include/features_roles");

// deployment utils (contract state printers)
const {
	print_erc20_acl_details,
	print_nft_acl_details,
	print_acl_details,
	get_service_wallets,
} = require("../scripts/deployment_utils");

// to be picked up and executed by hardhat-deploy plugin
module.exports = async function({deployments, getChainId, getNamedAccounts, getUnnamedAccounts}) {
	// print some useful info on the account we're using for the deployment
	const chainId = await getChainId();
	const [A0] = await web3.eth.getAccounts();
	let nonce = await web3.eth.getTransactionCount(A0);
	let balance = await web3.eth.getBalance(A0);

	// print initial debug information
	console.log("network %o %o", chainId, network.name);
	console.log("service account %o, nonce: %o, balance: %o ETH", A0, nonce, print_amt(balance));

	// ensure we're not deploying into the wrong place
	assert(
		network.name === "hardhat"
		|| network.name === "localhost"
		|| network.name === "polygon"
		|| network.name === "polygon2"
		|| network.name === "mumbai",
		"unsupported network: please make sure you're deploying into Polygon"
	);


	// Polygon ERC20 <- Polygon ChildChainManagerProxy role injection (Polygon bridge)
	{
		// get the deployment
		const deployment = await deployments.get("PolygonAliERC20v2");

		// print deployment info, and determine if Polygon ChildChainManagerProxy is injected
		const {polygonChildChainManagerProxy} = await getNamedAccounts();
		const {r1} = await print_erc20_acl_details(A0, deployment.abi, deployment.address, polygonChildChainManagerProxy);

		// verify if Polygon ChildChainManagerProxy is allowed to mint ERC20 and allow if required
		const requested_role = toBN(ROLE_TOKEN_CREATOR);
		if(!r1.eq(requested_role)) {
			// update the permissions as required
			const receipt = await deployments.execute(
				"PolygonAliERC20v2", // name: string,
				{from: A0}, // options: TxOptions,
				"updateRole", // methodName: string,
				polygonChildChainManagerProxy,
				requested_role.toString(10), // ...args: any[]
			);

			console.log(
				"PolygonAliERC20v2.updateRole(%o, 0x%o): %o",
				polygonChildChainManagerProxy,
				requested_role.toString(16),
				receipt.transactionHash
			);
		}
	}

	// ERC721 <- NFT Factory role injection
	{
		// get the deployment
		const deployment = await deployments.get("PolygonCharacter");

		// print deployment info, and determine if NFT Factory is injected
		const {address: nft_factory_address} = await deployments.get("CharacterFactory");
		const {r1} = await print_nft_acl_details(A0, deployment.abi, deployment.address, nft_factory_address);

		// verify if NFT Factory is allowed to mint NFT and allow if required
		const requested_role = toBN(ROLE_TOKEN_CREATOR);
		if(!r1.eq(requested_role)) {
			// update the permissions as required
			const receipt = await deployments.execute(
				"PolygonCharacter", // name: string,
				{from: A0}, // options: TxOptions,
				"updateRole", // methodName: string,
				nft_factory_address,
				requested_role.toString(10), // ...args: any[]
			);

			console.log(
				"PolygonCharacter.updateRole(%o, 0x%o): %o",
				nft_factory_address,
				requested_role.toString(16),
				receipt.transactionHash
			);
		}
	}

	// NFT Factory <- service wallets role injection
	{
		// get the deployment
		const deployment = await deployments.get("CharacterFactory");

		// get the service wallets array
		const serviceWallets = get_service_wallets();

		// iterate the service wallets array
		for(const service_wallet of serviceWallets) {
			// print deployment info, and determine if NFT Factory is injected
			const {r1} = await print_acl_details(A0, deployment.abi, deployment.address, service_wallet);

			// verify if service wallet is allowed to mint NFT via the factory, and allow if required
			const requested_role = toBN(ROLE_FACTORY_MINTER);
			if(!r1.eq(requested_role)) {
				// update the permissions as required
				const receipt = await deployments.execute(
					"CharacterFactory", // name: string,
					{from: A0}, // options: TxOptions,
					"updateRole", // methodName: string,
					service_wallet,
					requested_role.toString(10), // ...args: any[]
				);

				console.log(
					"CharacterFactory.updateRole(%o, 0x%o): %o",
					service_wallet,
					requested_role.toString(16),
					receipt.transactionHash
				);
			}
		}
	}
};

// Tags represent what the deployment script acts on. In general, it will be a single string value,
// the name of the contract it deploys or modifies.
// Then if another deploy script has such tag as a dependency, then when the latter deploy script has a specific tag
// and that tag is requested, the dependency will be executed first.
// https://www.npmjs.com/package/hardhat-deploy#deploy-scripts-tags-and-dependencies
module.exports.tags = ["v2_5_roles_polygon", "roles_polygon", "v2_5"];
