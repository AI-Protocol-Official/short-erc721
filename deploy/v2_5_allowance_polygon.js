// run: npx hardhat deploy --network mumbai --tags v2_5_allowance_polygon
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


	// Polygon ERC20 <- service wallets allowance injection
	{
		// get the deployment
		const deployment = await deployments.get("PolygonAliERC20v2");

		// get the service wallets array
		const serviceWallets = get_service_wallets();
		console.log(serviceWallets);

		// iterate the service wallets array
		for(const service_wallet of serviceWallets) {
			// print deployment info, and determine if service wallet is injected
			const {allowance} = await print_erc20_acl_details(A0, deployment.abi, deployment.address, service_wallet);

			// verify if service wallet is allowed to transfer the ERC20, and allow if required
			const requested_allowance = toBN(10).pow(toBN(24));
			if(allowance.lt(requested_allowance)) {
				// update the allowance as required
				const receipt = await deployments.execute(
					"PolygonAliERC20v2", // name: string,
					{from: A0}, // options: TxOptions,
					"approve", // methodName: string,
					service_wallet,
					requested_allowance.toString(10), // ...args: any[]
				);

				console.log(
					"PolygonAliERC20v2.approve(%o, %o): %o",
					service_wallet,
					requested_allowance.toString(10),
					receipt.transactionHash
				);
			}
		}
	}
};

function getServiceWallets() {
	// first try to read from the service wallets array
	const SERVICE_WALLETS = process.env.SERVICE_WALLETS;
	if(SERVICE_WALLETS) {
		return SERVICE_WALLETS.split(",");
	}

	// if it's not available, derive from service wallets mnemonic
	const service_wallets = [];
	const SERVICE_WALLETS_MNEMONIC = process.env.SERVICE_WALLETS_MNEMONIC;
	if(SERVICE_WALLETS_MNEMONIC) {
		const hd_wallet = HDWallet.fromMnemonic(SERVICE_WALLETS_MNEMONIC);
		for(let i = 0; i < 100; i++) {
			service_wallets.push(hd_wallet.derive(`m/44'/60'/0'/0/${i}`).getAddress().toString("hex"));
		}
	}
	return service_wallets;
}

// Tags represent what the deployment script acts on. In general, it will be a single string value,
// the name of the contract it deploys or modifies.
// Then if another deploy script has such tag as a dependency, then when the latter deploy script has a specific tag
// and that tag is requested, the dependency will be executed first.
// https://www.npmjs.com/package/hardhat-deploy#deploy-scripts-tags-and-dependencies
module.exports.tags = ["v2_5_allowance_polygon", "allowance_polygon", "v2_5"];
