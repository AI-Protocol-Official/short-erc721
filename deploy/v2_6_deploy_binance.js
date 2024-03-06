// deploy: npx hardhat deploy --network binance_testnet --tags v2_6_deploy_binance
// verify: npx hardhat etherscan-verify --network binance_testnet

// script is built for hardhat-deploy plugin:
// A Hardhat Plugin For Replicable Deployments And Easy Testing
// https://www.npmjs.com/package/hardhat-deploy

// we use assert to fail fast in case of any errors
const assert = require("assert");

// BN utils
const {
	toBN,
	print_amt,
} = require("../scripts/include/bn_utils");

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
		// deploy if required
		await deployments.deploy("BinanceAliERC20v2", {
			// address (or private key) that will perform the transaction.
			// you can use `getNamedAccounts` to retrieve the address you want by name.
			from: A0,
			contract: "BinanceAliERC20v2",
			// the list of argument for the constructor (or the upgrade function in case of proxy)
			// args: [],
			// if set it to true, will not attempt to deploy even if the contract deployed under the same name is different
			skipIfAlreadyDeployed: true,
			// if true, it will log the result of the deployment (tx hash, address and gas used)
			log: true,
		});

		// get deployment details
		const deployment = await deployments.get("BinanceAliERC20v2");

		// print deployment details
		await print_erc20_acl_details(A0, deployment.abi, deployment.address);
	}

	// ERC721
	{
		// deploy if required
		await deployments.deploy("BinanceTestArt", {
			// address (or private key) that will perform the transaction.
			// you can use `getNamedAccounts` to retrieve the address you want by name.
			from: A0,
			contract: "WhitelabelNFT",
			// the list of argument for the constructor (or the upgrade function in case of proxy)
			args: ["Test AI Art", "Test ART"],
			// if set it to true, will not attempt to deploy even if the contract deployed under the same name is different
			skipIfAlreadyDeployed: true,
			// if true, it will log the result of the deployment (tx hash, address and gas used)
			log: true,
		});

		// get deployment details
		const deployment = await deployments.get("BinanceTestArt");

		// print deployment details
		await print_nft_acl_details(A0, deployment.abi, deployment.address);
	}

	// ERC721
	{
		// deploy if required
		await deployments.deploy("BinanceVitalikArt", {
			// address (or private key) that will perform the transaction.
			// you can use `getNamedAccounts` to retrieve the address you want by name.
			from: A0,
			contract: "WhitelabelNFT",
			// the list of argument for the constructor (or the upgrade function in case of proxy)
			args: ["Vitalik AI Art", "ART"],
			// if set it to true, will not attempt to deploy even if the contract deployed under the same name is different
			skipIfAlreadyDeployed: true,
			// if true, it will log the result of the deployment (tx hash, address and gas used)
			log: true,
		});

		// get deployment details
		const deployment = await deployments.get("BinanceVitalikArt");

		// print deployment details
		await print_nft_acl_details(A0, deployment.abi, deployment.address);
	}

	// ERC721
	{
		// deploy if required
		await deployments.deploy("BinanceDigitalTwin", {
			// address (or private key) that will perform the transaction.
			// you can use `getNamedAccounts` to retrieve the address you want by name.
			from: A0,
			contract: "WhitelabelNFT",
			// the list of argument for the constructor (or the upgrade function in case of proxy)
			args: ["Digital Twin", "TWIN"],
			// if set it to true, will not attempt to deploy even if the contract deployed under the same name is different
			skipIfAlreadyDeployed: true,
			// if true, it will log the result of the deployment (tx hash, address and gas used)
			log: true,
		});

		// get deployment details
		const deployment = await deployments.get("BinanceDigitalTwin");

		// print deployment details
		await print_nft_acl_details(A0, deployment.abi, deployment.address);
	}

	// NFT Factory
	{
		// deploy if required
		await deployments.deploy("BinanceArtFactory", {
			// address (or private key) that will perform the transaction.
			// you can use `getNamedAccounts` to retrieve the address you want by name.
			from: A0,
			contract: "NFTFactoryV2",
			// the list of argument for the constructor (or the upgrade function in case of proxy)
			args: [1_111], // total supply hardcap
			// if set it to true, will not attempt to deploy even if the contract deployed under the same name is different
			skipIfAlreadyDeployed: true,
			// if true, it will log the result of the deployment (tx hash, address and gas used)
			log: true,
		});

		// get deployment details
		const deployment = await deployments.get("BinanceArtFactory");

		// print deployment details
		await print_acl_details(A0, deployment.abi, deployment.address);
	}
};

// Tags represent what the deployment script acts on. In general, it will be a single string value,
// the name of the contract it deploys or modifies.
// Then if another deploy script has such tag as a dependency, then when the latter deploy script has a specific tag
// and that tag is requested, the dependency will be executed first.
// https://www.npmjs.com/package/hardhat-deploy#deploy-scripts-tags-and-dependencies
module.exports.tags = ["v2_6_deploy_binance", "deploy_binance", "v2_6"];
