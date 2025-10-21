const LOTTERY_CONTRACT_ADDRESS = '0xdf755A5e14Aa523b0d5bD21D327460cb6a51F597'; // 随机奖励池
const FINAL_POOL_CONTRACT_ADDRESS = '0xb91D5439759668399e679957f81Ad2E24dccfbd6'; // 最终奖励池
const TOKEN_CONTRACT_ADDRESS = '0x9051B84Ea8d383C4765Bbc9975CB16722279AC15'; // 大富翁 token合约
const CHAIN_EXPLORER = 'https://bscscan.com/address/';
const BSC_RPC_URL = 'https://bsc-dataseed4.ninicoin.io'; // BSC 主网 RPC
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000001';

const LOTTERY_ABI = [{
    "inputs": [{
        "internalType": "address",
        "name": "user",
        "type": "address"
    }],
    "name": "getAllInfo",
    "outputs": [{
            "internalType": "uint256[]",
            "name": "",
            "type": "uint256[]"
        },
        {
            "internalType": "address[]",
            "name": "",
            "type": "address[]"
        },
        {
            "internalType": "uint256[]",
            "name": "",
            "type": "uint256[]"
        }
    ],
    "stateMutability": "view",
    "type": "function"
}];

async function loadLotteryInfo() {
    try {
        // 使用 BSC RPC 节点初始化 Web3
        const web3 = new Web3(BSC_RPC_URL);
        const contract = new web3.eth.Contract(LOTTERY_ABI, LOTTERY_CONTRACT_ADDRESS);

        // 使用零地址调用合约
        const result = await contract.methods.getAllInfo(ZERO_ADDRESS).call();

        const info = result[0];
        const winners = result[1];
        const winnersWinning = result[2];

        // 从合约获取 币安人生 价格 (USDT 单位)
        const blPrice = Number(web3.utils.fromWei(info[2], 'ether'));

        // 更新彩票奖池金额 (假设info[6]是彩票奖池)
        const lotteryAmount = Number(web3.utils.fromWei(info[6], 'ether'));
        const lotteryUsdValue = Number((lotteryAmount * blPrice).toFixed(2));

        // 更新最后买家奖池金额 (假设info[7]是最后买家奖池，如果不存在则使用一半)
        const lastBuyerAmount = info[7] ? Number(web3.utils.fromWei(info[7], 'ether')) : lotteryAmount;
        const lastBuyerUsdValue = Number((lastBuyerAmount * blPrice).toFixed(2));

        // 根据价格大小决定显示的小数位数
        const priceDisplay = blPrice >= 1 ?
            blPrice.toFixed(2) :
            blPrice.toFixed(6);

        // 更新彩票奖池显示
        const lotteryJackpotElement = document.getElementById('lottery-jackpot');
        if (lotteryJackpotElement) {
            lotteryJackpotElement.innerHTML = `<span style="font-size: 28px;font-weight: 900;">${lotteryAmount.toLocaleString('en-US', { maximumFractionDigits: 4, minimumFractionDigits: 4 })} BNB</span><br>
            <span style="font-size: 12px;">约 $${lotteryUsdValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span><br>
            <span style="font-size: 14px;">每15分钟开奖，3人瓜分</span><br>
            <span style="font-size: 12px; margin-top: 5px; opacity: 0.9;">奖励：BNB</span>`;
        }

        // 更新最后买家奖池显示
        const lastBuyerJackpotElement = document.getElementById('last-buyer-jackpot');
        if (lastBuyerJackpotElement) {
            lastBuyerJackpotElement.innerHTML = `<span style="font-size: 28px;font-weight: 900;">${lastBuyerAmount.toLocaleString('en-US', { maximumFractionDigits: 4, minimumFractionDigits: 4 })} BNB</span><br>
            <span style="font-size: 12px;">约 $${lastBuyerUsdValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span><br>
            <span style="font-size: 14px;">3分钟倒计时，200u门槛</span><br>
            <span style="font-size: 12px; margin-top: 5px; opacity: 0.9;">奖励：BNB</span>`;
        }

        // 更新最后开奖时间
        const lastDrawElement = document.getElementById('last-draw-time');
        if (lastDrawElement) {
            const lastDraw = new Date(Number(info[4]) * 1000);
            lastDrawElement.innerText = `最后开奖: ${lastDraw.toLocaleString('zh-CN')}`;
        }

        // 更新彩票中奖者列表
        const lotteryWinnersListElement = document.getElementById('lottery-winners-list');
        if (lotteryWinnersListElement) {
            lotteryWinnersListElement.innerHTML = '';
            if (winners.length === 0) {
                lotteryWinnersListElement.innerHTML = '<div style="text-align:center;padding:20px;color:#666;">暂无彩票中奖记录</div>';
            } else {
                let lotteryWinnersHTML = '<div style="max-height:400px;overflow-y:auto;">';
                for (let i = 0; i < winners.length; i++) {
                    const addr = winners[i];
                    const winAmount = winnersWinning[i] ? Number(web3.utils.fromWei(winnersWinning[i], 'ether')) : 0;
                    const winUSD = Number((winAmount * blPrice).toFixed(2));
                    lotteryWinnersHTML += `
                        <div style="padding:10px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;">
                            <a href="${CHAIN_EXPLORER}${addr}" target="_blank" 
                               style="color:#fec260;text-decoration:none;font-weight:600;"
                               title="在浏览器中查看">
                               ${addr.slice(0, 6)}...${addr.slice(-4)}
                            </a>
                            <span style="color:#4CAF50;font-weight:bold;">
                                +${winAmount.toLocaleString('en-US', { maximumFractionDigits: 4 })} 币安大富翁 
                                ($${parseFloat(winUSD).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BNB)
                            </span>
                        </div>
                    `;
                }
                lotteryWinnersHTML += '</div>';
                lotteryWinnersListElement.innerHTML = lotteryWinnersHTML;
            }
        }

        // 更新最后买家奖励列表 (暂时显示暂无记录，等待后续实现)
        const lastBuyerWinnersListElement = document.getElementById('last-buyer-winners-list');
        if (lastBuyerWinnersListElement) {
            lastBuyerWinnersListElement.innerHTML = '<div style="text-align:center;padding:20px;color:#666;">暂无最后买家奖励记录</div>';
        }

    } catch (e) {
        console.error('获取彩票信息失败:', e);
        const lotteryJackpotElement = document.getElementById('lottery-jackpot');
        const lastBuyerJackpotElement = document.getElementById('last-buyer-jackpot');
        const lotteryWinnersListElement = document.getElementById('lottery-winners-list');
        const lastBuyerWinnersListElement = document.getElementById('last-buyer-winners-list');
        
        if (lotteryJackpotElement) {
            lotteryJackpotElement.innerHTML = '<span style="font-size: 16px;color:#ff5252;">加载失败，请刷新页面重试</span>';
        }
        
        if (lastBuyerJackpotElement) {
            lastBuyerJackpotElement.innerHTML = '<span style="font-size: 16px;color:#ff5252;">加载失败，请刷新页面重试</span>';
        }

        if (lotteryWinnersListElement) {
            lotteryWinnersListElement.innerHTML = '<div style="text-align:center;padding:20px;color:#ff5252;">加载失败，请刷新页面重试</div>';
        }

        if (lastBuyerWinnersListElement) {
            lastBuyerWinnersListElement.innerHTML = '<div style="text-align:center;padding:20px;color:#ff5252;">加载失败，请刷新页面重试</div>';
        }
    }
}

// 页面加载完成后执行
window.addEventListener('DOMContentLoaded', () => {
    // 检查 web3.js 是否加载
    if (typeof Web3 === 'undefined') {
        const script = document.createElement('script');
        script.src = './web3.min.js';
        script.onload = loadLotteryInfo;
        document.body.appendChild(script);
    } else {
        loadLotteryInfo();
    }

    // 每6秒自动刷新一次数据
    setInterval(loadLotteryInfo, 6000);
});