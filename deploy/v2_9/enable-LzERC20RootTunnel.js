// deploy: npx hardhat deploy --network goerli --tags enable-LzERC20RootTunnel
// verify: npx hardhat etherscan-verify --network goerli

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

// ACL token features and roles
const {
	FEATURE_ENTRANCE_OPEN,
} = require("../../scripts/include/features_roles");

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

	// root tunnel is available only in L1
	assert(network.name === "mainnet" || network.name === "goerli", "unsupported network: " + network.name);

	// enable L1ERC20RootTunnel
	{
		// get impl deployment details
		const v1_deployment = await deployments.get("LzERC20RootTunnelV1");
		const v1_contract = new web3.eth.Contract(v1_deployment.abi, v1_deployment.address);

		// print v1 deployment details
		await print_contract_details(A0, v1_deployment.abi, v1_deployment.address);

		// get proxy deployment details
		const proxy_deployment = await deployments.get("LzERC20RootTunnel_Proxy");
		const proxy_contract = new web3.eth.Contract(v1_deployment.abi, proxy_deployment.address);

		// print proxy deployment details
		await print_contract_details(A0, v1_deployment.abi, proxy_deployment.address);

		// print deployment details, and determine if tunnel entrance is open
		const {features} = await print_contract_details(A0, v1_deployment.abi, proxy_deployment.address);

		// check if childTunnel is already set (setup complete)
		const child_tunnel_set = await proxy_contract.methods.childTunnelAddress().call();
		if(child_tunnel_set && child_tunnel_set !== ZERO_ADDRESS) {
			// verify if tunnel entrance is open and open it if required
			const requested_features = toBN(FEATURE_ENTRANCE_OPEN);
			if(!features.eq(requested_features)) {
				// prepare the updateFeatures call bytes for the contract call
				const call_data = proxy_contract.methods.updateFeatures(requested_features).encodeABI();

				// update the features as required
				const receipt = await deployments.rawTx({
					from: A0,
					to: proxy_deployment.address,
					data: call_data, // updateFeatures(requested_features)
				});
				console.log("LzERC20RootTunnel.updateFeatures(%o): %o", requested_features.toString(2), receipt.transactionHash);
			}
		}
		else {
			console.log();
			console.log("╔══════════════════════════════════════════════════════════════════════════════════════════════════╗");
			console.log("║ NOTE: childTunnel is not yet set on LzERC20RootTunnel. LzERC20RootTunnel cannot be enabled.      ║");
			console.log("║ Please rerun the script again once the LzERC20ChildTunnel is deployed and childTunnel is set.    ║");
			console.log("╚══════════════════════════════════════════════════════════════════════════════════════════════════╝");
			console.log();
		}
	}
};

// Tags represent what the deployment script acts on. In general, it will be a single string value,
// the name of the contract it deploys or modifies.
// Then if another deploy script has such tag as a dependency, then when the latter deploy script has a specific tag
// and that tag is requested, the dependency will be executed first.
// https://www.npmjs.com/package/hardhat-deploy#deploy-scripts-tags-and-dependencies
module.exports.tags = ["enable-LzERC20RootTunnel_l1", "v2_9", "setup", "L1", "l1"];
module.exports.dependencies = ["setup-LzERC20RootTunnel"];
