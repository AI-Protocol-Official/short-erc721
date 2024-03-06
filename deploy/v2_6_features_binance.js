// run: npx hardhat deploy --network binance_testnet --tags v2_6_features_binance

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
	FEATURE_ALL,
	FEATURE_TRANSFERS,
	FEATURE_TRANSFERS_ON_BEHALF,
	FEATURE_OWN_BURNS,
	FEATURE_MINTING_WITH_AUTH,
} = require("../scripts/include/features_roles");

// deployment utils (contract state printers)
const {
	print_erc20_acl_details,
	print_nft_acl_details,
	print_acl_details,
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
		|| network.name === "binance"
		|| network.name === "binance_testnet",
		"unsupported network: please make sure you're deploying into Binance Smart Chain"
	);

	// ERC20
	{
		// get the deployment
		const deployment = await deployments.get("BinanceAliERC20v2");

		// print deployment info, and determine if transfers are enabled
		const {features} = await print_erc20_acl_details(A0, deployment.abi, deployment.address);

		// verify if all the features are enabled and enable if required
		const requested_features = toBN(FEATURE_ALL);
		if(!features.eq(requested_features)) {
			// update the features as required
			const receipt = await deployments.execute(
				"BinanceAliERC20v2", // name: string,
				{from: A0}, // options: TxOptions,
				"updateFeatures", // methodName: string,
				requested_features.toString(10), // ...args: any[]
			);
			console.log("BinanceAliERC20v2.updateFeatures(%o): %o", requested_features.toString(2), receipt.transactionHash);
		}
	}

	// ERC721
	{
		// get the deployment
		const deployment = await deployments.get("BinanceTestArt");

		// print deployment info, and determine if transfers are enabled
		const {features} = await print_nft_acl_details(A0, deployment.abi, deployment.address);

		// verify if all the features are enabled and enable if required
		const requested_features = toBN(FEATURE_ALL);
		if(!features.eq(requested_features)) {
			// update the features as required
			const receipt = await deployments.execute(
				"BinanceTestArt", // name: string,
				{from: A0}, // options: TxOptions,
				"updateFeatures", // methodName: string,
				requested_features.toString(10), // ...args: any[]
			);
			console.log("BinanceTestArt.updateFeatures(%o): %o", requested_features.toString(2), receipt.transactionHash);
		}
	}

	// ERC721
	{
		// get the deployment
		const deployment = await deployments.get("BinanceVitalikArt");

		// print deployment info, and determine if transfers are enabled
		const {features} = await print_nft_acl_details(A0, deployment.abi, deployment.address);

		// verify if all the features are enabled and enable if required
		const requested_features = toBN(FEATURE_ALL);
		if(!features.eq(requested_features)) {
			// update the features as required
			const receipt = await deployments.execute(
				"BinanceVitalikArt", // name: string,
				{from: A0}, // options: TxOptions,
				"updateFeatures", // methodName: string,
				requested_features.toString(10), // ...args: any[]
			);
			console.log("BinanceVitalikArt.updateFeatures(%o): %o", requested_features.toString(2), receipt.transactionHash);
		}
	}

	// NFT Factory
	{
		// get the deployment
		const deployment = await deployments.get("BinanceArtFactory");

		// print deployment info, and determine if transfers are enabled
		const {features} = await print_acl_details(A0, deployment.abi, deployment.address);

		// verify if all the features are enabled and enable if required
		const requested_features = toBN(FEATURE_MINTING_WITH_AUTH);
		if(!features.eq(requested_features)) {
			// update the features as required
			const receipt = await deployments.execute(
				"BinanceArtFactory", // name: string,
				{from: A0}, // options: TxOptions,
				"updateFeatures", // methodName: string,
				requested_features.toString(10), // ...args: any[]
			);
			console.log("BinanceArtFactory.updateFeatures(%o): %o", requested_features.toString(2), receipt.transactionHash);
		}
	}
};

// Tags represent what the deployment script acts on. In general, it will be a single string value,
// the name of the contract it deploys or modifies.
// Then if another deploy script has such tag as a dependency, then when the latter deploy script has a specific tag
// and that tag is requested, the dependency will be executed first.
// https://www.npmjs.com/package/hardhat-deploy#deploy-scripts-tags-and-dependencies
module.exports.tags = ["v2_6_features_binance", "features_binance", "v2_6"];
