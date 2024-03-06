// deploy: npx hardhat deploy --network binance_testnet --tags v2_7_deploy_char_token
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
		await deployments.deploy("CharacterERC20", {
			// address (or private key) that will perform the transaction.
			// you can use `getNamedAccounts` to retrieve the address you want by name.
			from: A0,
			contract: "CharacterERC20",
			// the list of argument for the constructor (or the upgrade function in case of proxy)
			// args: [],
			// if set it to true, will not attempt to deploy even if the contract deployed under the same name is different
			skipIfAlreadyDeployed: true,
			// if true, it will log the result of the deployment (tx hash, address and gas used)
			log: true,
		});

		// get deployment details
		const deployment = await deployments.get("CharacterERC20");

		// print deployment details
		await print_erc20_acl_details(A0, deployment.abi, deployment.address);
	}

	// ERC20 Deployer
	{
		// get the ERC20 impl
		const impl_deployment = await deployments.get("CharacterERC20");

		// deploy if required
		await deployments.deploy("CharacterERC20Deployer", {
			// address (or private key) that will perform the transaction.
			// you can use `getNamedAccounts` to retrieve the address you want by name.
			from: A0,
			contract: "CharacterERC20Deployer",
			// the list of argument for the constructor (or the upgrade function in case of proxy)
			args: [impl_deployment.address],
			// if set it to true, will not attempt to deploy even if the contract deployed under the same name is different
			skipIfAlreadyDeployed: true,
			// if true, it will log the result of the deployment (tx hash, address and gas used)
			log: true,
		});

		// get deployment details
		const deployment = await deployments.get("CharacterERC20Deployer");

		// print deployment details
		const web3_contract = new web3.eth.Contract(deployment.abi, deployment.address);
		const characterErc20ImplAddress = await web3_contract.methods.characterErc20ImplAddress().call();
		console.log("successfully connected to contract at %o", deployment.address);
		console.table([
			{"key": "characterErc20ImplAddress", "value": characterErc20ImplAddress},
		]);
	}
};

// Tags represent what the deployment script acts on. In general, it will be a single string value,
// the name of the contract it deploys or modifies.
// Then if another deploy script has such tag as a dependency, then when the latter deploy script has a specific tag
// and that tag is requested, the dependency will be executed first.
// https://www.npmjs.com/package/hardhat-deploy#deploy-scripts-tags-and-dependencies
module.exports.tags = ["v2_7_deploy_char_token", "deploy_char_token", "v2_7"];
