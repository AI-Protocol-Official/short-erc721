// deploy: npx hardhat deploy --network base_goerli --tags OpAliERC20v2
// verify: npx hardhat etherscan-verify --network base_goerli --api-url https://api-goerli.basescan.org/ --api-key $BASESCAN_KEY

// script is built for hardhat-deploy plugin:
// A Hardhat Plugin For Replicable Deployments And Easy Testing
// https://www.npmjs.com/package/hardhat-deploy

// BN utils
const {
	toBN,
	print_amt,
} = require("../../scripts/include/bn_utils");

// Zeppelin helper constants
const {
	ZERO_ADDRESS,
	ZERO_BYTES32,
	MAX_UINT256,
} = require("@openzeppelin/test-helpers/src/constants");

// deployment utils (contract state printers)
const {
	print_contract_details,
} = require("../../scripts/deployment_utils");

// to be picked up and executed by hardhat-deploy plugin
module.exports = async function({deployments, getChainId, getNamedAccounts, getUnnamedAccounts}) {
	// print some useful info on the account we're using for the deployment
	const chainId = await getChainId();
	const accounts = await web3.eth.getAccounts();
	// do not use the default account for tests
	const A0 = network.name === "hardhat"? accounts[1]: accounts[0];
	const nonce = await web3.eth.getTransactionCount(A0);
	const balance = await web3.eth.getBalance(A0);

	// print initial debug information
	console.log("script: %o", require("path").basename(__filename));
	console.log("network %o %o", chainId, network.name);
	console.log("accounts: %o, service account %o, nonce: %o, balance: %o ETH", accounts.length, A0, nonce, print_amt(balance));

	// the script is designed to be run in L2 only
	assert(
		network.name === "base_mainnet" || network.name === "base_goerli"
		|| network.name === "opBnb" || network.name === "opBnb_testnet"
		|| network.name === "localhost" || network.name === "hardhat",
		"unsupported network: " + network.name
	);

	// OpAliERC20v2 – L2 networks like opBNB
	{
		// get OP Stack StandardBridge address, ALI token address
		const {
			opStandardBridge: bridge_address,
			RemoteAliERC20v2: remote_token,
		} = await getNamedAccounts();

		// deploy if required
		await deployments.deploy("OpAliERC20v2", {
			// address (or private key) that will perform the transaction.
			// you can use `getNamedAccounts` to retrieve the address you want by name.
			from: A0,
			contract: "OpAliERC20v2",
			// the list of argument for the constructor (or the upgrade function in case of proxy)
			args: [bridge_address, remote_token],
			// if set it to true, will not attempt to deploy even if the contract deployed under the same name is different
			skipIfAlreadyDeployed: true,
			// if true, it will log the result of the deployment (tx hash, address and gas used)
			log: true,
		});

		// get deployment details
		const deployment = await deployments.get("OpAliERC20v2");
		const contract = new web3.eth.Contract(deployment.abi, deployment.address);

		// print deployment details
		await print_contract_details(A0, deployment.abi, deployment.address);
	}
};

// Tags represent what the deployment script acts on. In general, it will be a single string value,
// the name of the contract it deploys or modifies.
// Then if another deploy script has such tag as a dependency, then when the latter deploy script has a specific tag
// and that tag is requested, the dependency will be executed first.
// https://www.npmjs.com/package/hardhat-deploy#deploy-scripts-tags-and-dependencies
module.exports.tags = ["OpAliERC20v2", "v2_8", "deploy", "L2", "l2"];
