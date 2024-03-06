// run: npx hardhat deploy --network binance_testnet --tags access-ChildAliERC20v2

// script is built for hardhat-deploy plugin:
// A Hardhat Plugin For Replicable Deployments And Easy Testing
// https://www.npmjs.com/package/hardhat-deploy

// BN utils
const {
	toBN,
	print_amt,
} = require("../../scripts/include/bn_utils");

// ACL token features and roles
const {
	ROLE_TOKEN_CREATOR,
	ROLE_TOKEN_DESTROYER,
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

	// the script is designed to be run in L2 only
	assert(network.name === "binance" || network.name === "binance_testnet", "unsupported network: " + network.name);

	// grant access on ChildAliERC20v2 to LzERC20ChildTunnel_Proxy
	{
		// get access provider deployment details
		const provider_deployment = await deployments.get("ChildAliERC20v2");
		const provider_contract = new web3.eth.Contract(provider_deployment.abi, provider_deployment.address);

		// get access recipient deployment details
		const recipient_deployment = await deployments.get("LzERC20ChildTunnel_Proxy");
		// TODO: impl ABI, not proxy
		const recipient_contract = new web3.eth.Contract(recipient_deployment.abi, recipient_deployment.address);

		// print proxy info, and determine if transfers are enabled
		const {r1} = await print_contract_details(A0, provider_deployment.abi, provider_deployment.address, recipient_deployment.address);

		// verify if recipient has the access required and provide it if needed
		const requested_access = toBN(ROLE_TOKEN_CREATOR | ROLE_TOKEN_DESTROYER);
		if(!r1.eq(requested_access)) {
			// prepare the updateRole call bytes for the contract call
			const call_data = provider_contract.methods.updateRole(recipient_deployment.address, requested_access).encodeABI();

			// update the features as required
			const receipt = await deployments.rawTx({
				from: A0,
				to: provider_deployment.address,
				data: call_data, // updateRole(recipient_deployment.address, requested_access)
			});
			console.log(
				"ChildAliERC20v2.updateRole(%o, %o): %o",
				recipient_deployment.address,
				requested_access.toString(2),
				receipt.transactionHash
			);
		}
	}
};

// Tags represent what the deployment script acts on. In general, it will be a single string value,
// the name of the contract it deploys or modifies.
// Then if another deploy script has such tag as a dependency, then when the latter deploy script has a specific tag
// and that tag is requested, the dependency will be executed first.
// https://www.npmjs.com/package/hardhat-deploy#deploy-scripts-tags-and-dependencies
module.exports.tags = ["access-ChildAliERC20v2", "v2_9", "access", "L2", "l2"];
module.exports.dependencies = ["ChildAliERC20v2", "LzERC20ChildTunnel_Proxy"];
