import { Provider, Contract } from 'ethcall';

import dsProxyRegistryAbi from '../abi/DSProxyRegistry.json';
import erc20Abi from '../abi/ERC20.json';

import config, { TokenMetadata } from '@/config';
import { ETH_KEY, getTrustwalletLink } from '@/utils/helpers';
import provider from '@/utils/provider';

export type Allowances = Record<string, Record<string, string>>;

export type Balances = Record<string, string>;

export interface AccountState {
    allowances: Allowances;
    balances: Balances;
    proxy: string;
}

export default class Ethereum {
    static async fetchAccountState(address: string, assets: string[]): Promise<AccountState> {
        assets = assets.filter(asset => asset !== ETH_KEY);
        const ethcallProvider = new Provider();
        await ethcallProvider.init(provider);
        const calls = [];
        // Fetch balances and allowances
        const exchangeProxyAddress = config.addresses.exchangeProxy;
        for (const tokenAddress of assets) {
            const tokenContract = new Contract(tokenAddress, erc20Abi);
            const balanceCall = tokenContract.balanceOf(address);
            const allowanceCall = tokenContract.allowance(address, exchangeProxyAddress);
            calls.push(balanceCall);
            calls.push(allowanceCall);
        }
        // Fetch ether balance
        const ethBalanceCall = ethcallProvider.getEthBalance(address);
        calls.push(ethBalanceCall);
        // Fetch proxy
        const dsProxyRegistryAddress = config.addresses.dsProxyRegistry;
        const dsProxyRegistryContract = new Contract(
            dsProxyRegistryAddress,
            dsProxyRegistryAbi,
        );
        const proxyCall = dsProxyRegistryContract.proxies(address);
        calls.push(proxyCall);
        // Fetch data
        const data = await ethcallProvider.all(calls);
        const tokenCount = assets.length;
        const allowances = {};
        allowances[exchangeProxyAddress] = {};
        const balances: Record<string, string> = {};
        let i = 0;
        for (const tokenAddress of assets) {
            balances[tokenAddress] = data[2 * i].toString();
            allowances[exchangeProxyAddress][tokenAddress] = data[2 * i + 1].toString();
            i++;
        }
        balances.ether = data[2 * tokenCount].toString();
        const proxy = data[2 * tokenCount + 1];
        return { allowances, balances, proxy };
    }

    static async fetchTokenMetadata(assets: string[]): Promise<Record<string, TokenMetadata>> {
        const ethcallProvider = new Provider();
        await ethcallProvider.init(provider);
        const calls = [];
        // Fetch token metadata
        for (const tokenAddress of assets) {
            const tokenContract = new Contract(tokenAddress, erc20Abi);
            const nameCall = tokenContract.name();
            const symbolCall = tokenContract.symbol();
            const decimalCall = tokenContract.decimals();
            calls.push(nameCall);
            calls.push(symbolCall);
            calls.push(decimalCall);
        }
        // Fetch data
        const data = await ethcallProvider.all(calls);
        const metadata: Record<string, TokenMetadata> = {};
        for (let i = 0; i < assets.length; i++) {
            const tokenAddress = assets[i];
            const name = data[3 * i];
            const symbol = data[3 * i + 1];
            const decimals = data[3 * i + 2];
            metadata[tokenAddress] = {
                address: tokenAddress,
                name,
                symbol,
                decimals,
                logoUrl: getTrustwalletLink(tokenAddress),
            };
        }
        return metadata;
    }
}
