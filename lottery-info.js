const LOTTERY_CONTRACT_ADDRESS = '0x9003e40c5780517BbcF58D4D2c67324933fAFBDf'; // 抽奖合约（随机奖励池）
const FINAL_POOL_CONTRACT_ADDRESS = '0x51B9804Eb4a0BC900b579601b009A0716872c802'; // 最后买家合约（最终奖励池）
const TOKEN_CONTRACT_ADDRESS = '0x3d2EFA57F8A5B0403a9FBB34C694A44D2bF19862'; // 大富翁 token合约
const CHAIN_EXPLORER = 'https://bscscan.com/address/';
const BSC_RPC_URL = 'https://bsc-dataseed4.ninicoin.io'; // BSC 主网 RPC
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000001';
const BSC_CHAIN_ID = '0x38'; // BSC 主网 Chain ID (56)
const BSC_CHAIN_ID_DECIMAL = 56;

// 钱包状态
let walletConnected = false;
let userAddress = null;
let web3Instance = null;

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
}, {
    "inputs": [],
    "name": "getLastBuyerInfo",
    "outputs": [{
            "internalType": "address",
            "name": "lastBuyer",
            "type": "address"
        },
        {
            "internalType": "uint256",
            "name": "lastBuyTime",
            "type": "uint256"
        },
        {
            "internalType": "uint256",
            "name": "countdownEndTime",
            "type": "uint256"
        }
    ],
    "stateMutability": "view",
    "type": "function"
}, {
    "inputs": [],
    "name": "drawWinners",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
}, {
    "inputs": [],
    "name": "winner",
    "outputs": [{
        "internalType": "address",
        "name": "",
        "type": "address"
    }],
    "stateMutability": "view",
    "type": "function"
}];

async function loadLotteryInfo() {
    try {
        // 使用 BSC RPC 节点初始化 Web3
        const web3 = new Web3(BSC_RPC_URL);
        
        // 彩票奖池合约
        const lotteryContract = new web3.eth.Contract(LOTTERY_ABI, LOTTERY_CONTRACT_ADDRESS);
        const lotteryResult = await lotteryContract.methods.getAllInfo(ZERO_ADDRESS).call();

        const lotteryInfo = lotteryResult[0];
        const lotteryWinners = lotteryResult[1];
        const lotteryWinnersWinning = lotteryResult[2];

        // 从彩票合约获取价格信息
        const blPrice = Number(web3.utils.fromWei(lotteryInfo[2], 'ether'));

        // 更新彩票奖池金额
        const lotteryAmount = Number(web3.utils.fromWei(lotteryInfo[6], 'ether'));
        const lotteryUsdValue = Number((lotteryAmount * blPrice).toFixed(2));

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

        // 获取最终奖励池合约的金额和历史记录
        let finalPoolAmount = 0;
        let finalPoolUsdValue = 0;
        let lastBuyerWinners = [];
        let lastBuyerWinningsAmount = [];
        let currentWinner = ZERO_ADDRESS;
        
        try {
            const finalPoolContract = new web3.eth.Contract(LOTTERY_ABI, FINAL_POOL_CONTRACT_ADDRESS);
            const finalPoolInfo = await finalPoolContract.methods.getAllInfo(ZERO_ADDRESS).call();
            
            // 获取奖池金额 (索引6或7)
            finalPoolAmount = Number(web3.utils.fromWei(finalPoolInfo[0][7] || finalPoolInfo[0][6], 'ether'));
            finalPoolUsdValue = Number((finalPoolAmount * blPrice).toFixed(2));
            
            // 获取最后买家历史中奖记录
            lastBuyerWinners = finalPoolInfo[1] || []; // 中奖者地址数组
            lastBuyerWinningsAmount = finalPoolInfo[2] || []; // 中奖金额数组
            
            // 获取当前中奖者
            try {
                currentWinner = await finalPoolContract.methods.winner().call();
            } catch (e) {
                console.error('获取当前中奖者失败:', e);
            }
            
        } catch (e) {
            console.error('获取最终奖励池信息失败:', e);
        }

        // 更新最后开奖时间
        const lastDrawElement = document.getElementById('last-draw-time');
        if (lastDrawElement) {
            const lastDraw = new Date(Number(lotteryInfo[4]) * 1000);
            lastDrawElement.innerText = `最后开奖: ${lastDraw.toLocaleString('zh-CN')}`;
        }

        // 更新彩票中奖者列表
        const lotteryWinnersListElement = document.getElementById('lottery-winners-list');
        if (lotteryWinnersListElement) {
            lotteryWinnersListElement.innerHTML = '';
            if (lotteryWinners.length === 0) {
                lotteryWinnersListElement.innerHTML = '<div style="text-align:center;padding:20px;color:#666;">暂无彩票中奖记录</div>';
            } else {
                let lotteryWinnersHTML = '<div style="max-height:400px;overflow-y:auto;">';
                for (let i = 0; i < lotteryWinners.length; i++) {
                    const addr = lotteryWinners[i];
                    const winAmount = lotteryWinnersWinning[i] ? Number(web3.utils.fromWei(lotteryWinnersWinning[i], 'ether')) : 0;
                    const winUSD = Number((winAmount * blPrice).toFixed(2));
                    lotteryWinnersHTML += `
                        <div style="padding:10px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;">
                            <a href="${CHAIN_EXPLORER}${addr}" target="_blank" 
                               style="color:#fec260;text-decoration:none;font-weight:600;"
                               title="在浏览器中查看">
                               ${addr.slice(0, 6)}...${addr.slice(-4)}
                            </a>
                            <span style="color:#4CAF50;font-weight:bold;">
                                +${winAmount.toLocaleString('en-US', { maximumFractionDigits: 4 })} BNB 
                                ($${parseFloat(winUSD).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                            </span>
                        </div>
                    `;
                }
                lotteryWinnersHTML += '</div>';
                lotteryWinnersListElement.innerHTML = lotteryWinnersHTML;
            }
        }

        // 获取最后买家信息 - 从token合约获取数据
        let lastBuyer = ZERO_ADDRESS;
        let lastBuyTime = 0;
        let countdownEndTime = 0;
        
        try {
            // 从token合约获取最后买家地址和倒计时信息
            const tokenContract = new web3.eth.Contract(LOTTERY_ABI, TOKEN_CONTRACT_ADDRESS);
            const lastBuyerInfo = await tokenContract.methods.getLastBuyerInfo().call();
            lastBuyer = lastBuyerInfo[0];
            lastBuyTime = Number(lastBuyerInfo[1]);
            countdownEndTime = Number(lastBuyerInfo[2]);
        } catch (e) {
            console.error('获取最后买家信息失败:', e);
        }

        // 更新最后买家奖池显示 - 包含倒计时和领取按钮
        const lastBuyerJackpotElement = document.getElementById('last-buyer-jackpot');
        if (lastBuyerJackpotElement) {
            const now = Math.floor(Date.now() / 1000);
            const isExpired = now > countdownEndTime;
            
            let jackpotHTML = `
                <span style="font-size: 28px;font-weight: 900;">${finalPoolAmount.toLocaleString('en-US', { maximumFractionDigits: 4, minimumFractionDigits: 4 })} BNB</span><br>
                <span style="font-size: 12px;">约 $${finalPoolUsdValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span><br>
            `;
            
            if (lastBuyer !== ZERO_ADDRESS) {
                jackpotHTML += `
                    <div id="last-buyer-countdown" class="countdown-display" style="margin-top:10px;">⏰ 00:00</div>
                    <div style="font-size:0.85rem;margin-top:8px;opacity:0.9;">
                        最后买家: <span style="font-family:monospace;">${lastBuyer.slice(0, 6)}...${lastBuyer.slice(-4)}</span>
                    </div>
                `;
                
                // 显示当前中奖者（如果存在且不是零地址）
                if (currentWinner !== ZERO_ADDRESS && currentWinner.toLowerCase() !== '0x0000000000000000000000000000000000000000') {
                    jackpotHTML += `
                        <div style="font-size:0.85rem;margin-top:8px;color:#4CAF50;font-weight:bold;">
                            🏆 中奖者: <span style="font-family:monospace;">${currentWinner.slice(0, 6)}...${currentWinner.slice(-4)}</span>
                        </div>
                    `;
                }
                
                jackpotHTML += `
                    <button onclick="claimLastBuyerReward()" 
                            style="background:linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
                                   color:white;
                                   border:none;
                                   padding:8px 16px;
                                   border-radius:8px;
                                   font-size:0.9rem;
                                   font-weight:600;
                                   cursor:pointer;
                                   transition:all 0.3s ease;
                                   box-shadow:0 4px 15px rgba(255, 107, 107, 0.3);
                                   margin-top:10px;"
                            onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 20px rgba(255, 107, 107, 0.5)'"
                            onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 4px 15px rgba(255, 107, 107, 0.3)'">
                        🎁 领取奖励 (drawWinners)
                    </button>
                `;
            } else {
                jackpotHTML += `
                    <div style="font-size: 14px;margin-top:10px;">3分钟倒计时，200u门槛</div>
                    <div style="font-size: 12px; margin-top: 5px; opacity: 0.9;">奖励：BNB</div>
                `;
            }
            
            lastBuyerJackpotElement.innerHTML = jackpotHTML;
        }

        // 更新最后买家奖励列表（包含历史记录）
        try {
            const lastBuyerWinnersListElement = document.getElementById('last-buyer-winners-list');
            if (lastBuyerWinnersListElement) {
                let lastBuyerHTML = '';
                
                // 显示当前最后买家
                if (lastBuyer !== ZERO_ADDRESS) {
                    const lastBuyDate = new Date(lastBuyTime * 1000);
                    lastBuyerHTML += `
                        <div style="padding:15px;text-align:center;background:linear-gradient(135deg, rgba(254, 194, 96, 0.1) 0%, rgba(255, 107, 107, 0.1) 100%);border-radius:10px;margin-bottom:15px;border:1px solid rgba(254, 194, 96, 0.3);">
                            <div style="margin-bottom:10px;">
                                <div style="color:#2d3748;font-size:0.9rem;margin-bottom:5px;font-weight:bold;">🎯 当前最后买家:</div>
                                <a href="${CHAIN_EXPLORER}${lastBuyer}" target="_blank" 
                                   style="color:#fec260;text-decoration:none;font-weight:600;font-size:1.1rem;"
                                   title="在浏览器中查看">
                                   ${lastBuyer.slice(0, 6)}...${lastBuyer.slice(-4)}
                                </a>
                            </div>
                            <div style="color:#666;font-size:0.85rem;">
                                买入时间: ${lastBuyDate.toLocaleString('zh-CN')}
                            </div>
                        </div>
                    `;
                }
                
                // 显示历史中奖记录
                if (lastBuyerWinners.length === 0) {
                    if (lastBuyer === ZERO_ADDRESS) {
                        lastBuyerHTML += '<div style="text-align:center;padding:20px;color:#666;">暂无最后买家记录</div>';
                    } else {
                        lastBuyerHTML += '<div style="text-align:center;padding:10px;color:#666;font-size:0.9rem;">暂无历史中奖记录</div>';
                    }
                } else {
                    lastBuyerHTML += '<div style="border-top:2px solid #f0f0f0;padding-top:10px;">';
                    lastBuyerHTML += '<div style="text-align:center;color:#2d3748;font-weight:bold;margin-bottom:10px;font-size:0.95rem;">🏆 历史中奖记录</div>';
                    lastBuyerHTML += '<div style="max-height:300px;overflow-y:auto;">';
                    
                    for (let i = 0; i < lastBuyerWinners.length; i++) {
                        const addr = lastBuyerWinners[i];
                        const winAmount = lastBuyerWinningsAmount[i] ? Number(web3.utils.fromWei(lastBuyerWinningsAmount[i], 'ether')) : 0;
                        const winUSD = Number((winAmount * blPrice).toFixed(2));
                        lastBuyerHTML += `
                            <div style="padding:10px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;">
                                <a href="${CHAIN_EXPLORER}${addr}" target="_blank" 
                                   style="color:#fec260;text-decoration:none;font-weight:600;"
                                   title="在浏览器中查看">
                                   ${addr.slice(0, 6)}...${addr.slice(-4)}
                                </a>
                                <span style="color:#ff6b6b;font-weight:bold;">
                                    +${winAmount.toLocaleString('en-US', { maximumFractionDigits: 4 })} BNB 
                                    ($${parseFloat(winUSD).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                                </span>
                            </div>
                        `;
                    }
                    lastBuyerHTML += '</div></div>';
                }
                
                lastBuyerWinnersListElement.innerHTML = lastBuyerHTML;
            }
            
            // 启动倒计时（如果有最后买家）
            if (lastBuyer !== ZERO_ADDRESS) {
                startCountdown(countdownEndTime);
            }
            
        } catch (e) {
            console.error('获取最后买家信息失败:', e);
            const lastBuyerWinnersListElement = document.getElementById('last-buyer-winners-list');
            if (lastBuyerWinnersListElement) {
                lastBuyerWinnersListElement.innerHTML = '<div style="text-align:center;padding:20px;color:#ff5252;">获取最后买家信息失败</div>';
            }
        }

    } catch (e) {
        console.error('获取彩票信息失败:', e);
        const lotteryJackpotElem = document.getElementById('lottery-jackpot');
        const lastBuyerJackpotElem = document.getElementById('last-buyer-jackpot');
        const lotteryWinnersListElem = document.getElementById('lottery-winners-list');
        const lastBuyerWinnersListElem = document.getElementById('last-buyer-winners-list');
        
        if (lotteryJackpotElem) {
            lotteryJackpotElem.innerHTML = '<span style="font-size: 16px;color:#ff5252;">加载失败，请刷新页面重试</span>';
        }
        
        if (lastBuyerJackpotElem) {
            lastBuyerJackpotElem.innerHTML = '<span style="font-size: 16px;color:#ff5252;">加载失败，请刷新页面重试</span>';
        }

        if (lotteryWinnersListElem) {
            lotteryWinnersListElem.innerHTML = '<div style="text-align:center;padding:20px;color:#ff5252;">加载失败，请刷新页面重试</div>';
        }

        if (lastBuyerWinnersListElem) {
            lastBuyerWinnersListElem.innerHTML = '<div style="text-align:center;padding:20px;color:#ff5252;">加载失败，请刷新页面重试</div>';
        }
    }
}

// 倒计时功能
function startCountdown(countdownEndTime) {
    const countdownElement = document.getElementById('last-buyer-countdown');
    if (!countdownElement) return;
    
    function updateCountdown() {
        const now = Math.floor(Date.now() / 1000);
        const timeLeft = countdownEndTime - now;
        
        if (timeLeft <= 0) {
            countdownElement.innerHTML = '⏰ 倒计时结束！';
            countdownElement.className = 'countdown-display danger';
            return;
        }
        
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        
        const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        // 移除所有状态类
        countdownElement.className = 'countdown-display';
        
        if (timeLeft <= 60) {
            // 最后1分钟 - 红色危险状态
            countdownElement.innerHTML = `⏰ ${timeString}`;
            countdownElement.className = 'countdown-display danger';
        } else if (timeLeft <= 180) {
            // 1-3分钟 - 橙色警告状态
            countdownElement.innerHTML = `⏰ ${timeString}`;
            countdownElement.className = 'countdown-display warning';
        } else {
            // 超过3分钟 - 绿色正常状态
            countdownElement.innerHTML = `⏰ ${timeString}`;
            countdownElement.className = 'countdown-display';
        }
    }
    
    updateCountdown();
    const countdownInterval = setInterval(updateCountdown, 1000);
    
    // 存储interval ID以便后续清理
    window.lastBuyerCountdownInterval = countdownInterval;
}

// 清理倒计时
function clearCountdown() {
    if (window.lastBuyerCountdownInterval) {
        clearInterval(window.lastBuyerCountdownInterval);
        window.lastBuyerCountdownInterval = null;
    }
}

// 页面加载完成后执行
window.addEventListener('DOMContentLoaded', () => {
    // 检查 web3.js 是否加载
    if (typeof Web3 === 'undefined') {
        const script = document.createElement('script');
        script.src = './web3.min.js';
        script.onload = () => {
            loadLotteryInfo();
            initWallet();
        };
        document.body.appendChild(script);
    } else {
        loadLotteryInfo();
        initWallet();
    }

    // 每6秒自动刷新一次数据
    setInterval(() => {
        clearCountdown(); // 清理旧的倒计时
        loadLotteryInfo();
    }, 6000);
});

// ==================== 钱包连接功能 ====================

// 初始化钱包
function initWallet() {
    const connectBtn = document.getElementById('wallet-connect-btn');
    if (connectBtn) {
        connectBtn.addEventListener('click', handleWalletConnect);
    }

    // 检查是否已经连接过
    if (window.ethereum) {
        window.ethereum.request({ method: 'eth_accounts' })
            .then(accounts => {
                if (accounts.length > 0) {
                    connectWallet(accounts[0]);
                }
            });

        // 监听账户变化
        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', handleChainChanged);
    }
}

// 处理钱包连接按钮点击
async function handleWalletConnect() {
    if (walletConnected) {
        // 已连接，显示钱包信息
        showWalletModal();
    } else {
        // 未连接，开始连接
        await connectWalletRequest();
    }
}

// 请求连接钱包
async function connectWalletRequest() {
    if (typeof window.ethereum === 'undefined') {
        alert('请安装 MetaMask 钱包！\n\n您可以在 https://metamask.io 下载安装。');
        return;
    }

    try {
        // 请求账户访问
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        
        if (accounts.length > 0) {
            // 检查网络
            const chainId = await window.ethereum.request({ method: 'eth_chainId' });
            
            if (chainId !== BSC_CHAIN_ID) {
                // 尝试切换到 BSC 网络
                await switchToBSC();
            } else {
                connectWallet(accounts[0]);
            }
        }
    } catch (error) {
        console.error('连接钱包失败:', error);
        if (error.code === 4001) {
            alert('您拒绝了连接请求');
        } else {
            alert('连接钱包失败，请重试');
        }
    }
}

// 切换到 BSC 网络
async function switchToBSC() {
    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: BSC_CHAIN_ID }],
        });
        
        // 切换成功后连接钱包
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
            connectWallet(accounts[0]);
        }
    } catch (switchError) {
        // 如果网络不存在，尝试添加
        if (switchError.code === 4902) {
            try {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: BSC_CHAIN_ID,
                        chainName: 'BNB Smart Chain',
                        nativeCurrency: {
                            name: 'BNB',
                            symbol: 'BNB',
                            decimals: 18
                        },
                        rpcUrls: ['https://bsc-dataseed.binance.org/'],
                        blockExplorerUrls: ['https://bscscan.com/']
                    }],
                });
                
                // 添加成功后连接钱包
                const accounts = await window.ethereum.request({ method: 'eth_accounts' });
                if (accounts.length > 0) {
                    connectWallet(accounts[0]);
                }
            } catch (addError) {
                console.error('添加 BSC 网络失败:', addError);
                alert('添加 BSC 网络失败，请手动添加');
            }
        } else {
            console.error('切换网络失败:', switchError);
            alert('请切换到 BSC 网络');
        }
    }
}

// 连接钱包
function connectWallet(address) {
    walletConnected = true;
    userAddress = address;
    web3Instance = new Web3(window.ethereum);
    
    updateWalletButton();
    console.log('钱包已连接:', address);
}

// 更新钱包按钮显示
function updateWalletButton() {
    const connectBtn = document.getElementById('wallet-connect-btn');
    const btnText = document.getElementById('wallet-btn-text');
    
    if (walletConnected && userAddress) {
        connectBtn.classList.add('connected');
        const shortAddress = `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`;
        btnText.innerHTML = `<span class="wallet-address">${shortAddress}</span>`;
    } else {
        connectBtn.classList.remove('connected');
        btnText.textContent = '连接钱包';
    }
}

// 显示钱包信息模态框
async function showWalletModal() {
    if (!walletConnected || !userAddress) return;
    
    const modal = document.getElementById('wallet-modal');
    const addressElement = document.getElementById('modal-wallet-address');
    const networkElement = document.getElementById('modal-network');
    const bnbBalanceElement = document.getElementById('modal-bnb-balance');
    const tokenBalanceElement = document.getElementById('modal-token-balance');
    
    // 显示地址
    addressElement.textContent = `${userAddress.slice(0, 10)}...${userAddress.slice(-8)}`;
    
    // 显示网络
    try {
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        const chainIdDecimal = parseInt(chainId, 16);
        networkElement.textContent = chainIdDecimal === BSC_CHAIN_ID_DECIMAL ? 'BSC 主网' : `Chain ID: ${chainIdDecimal}`;
    } catch (e) {
        networkElement.textContent = '未知';
    }
    
    // 获取 BNB 余额
    try {
        const balance = await web3Instance.eth.getBalance(userAddress);
        const bnbBalance = web3Instance.utils.fromWei(balance, 'ether');
        bnbBalanceElement.textContent = `${parseFloat(bnbBalance).toFixed(4)} BNB`;
    } catch (e) {
        bnbBalanceElement.textContent = '获取失败';
    }
    
    // 获取代币余额
    try {
        const tokenContract = new web3Instance.eth.Contract([
            {
                "constant": true,
                "inputs": [{"name": "_owner", "type": "address"}],
                "name": "balanceOf",
                "outputs": [{"name": "balance", "type": "uint256"}],
                "type": "function"
            }
        ], TOKEN_CONTRACT_ADDRESS);
        
        const tokenBalance = await tokenContract.methods.balanceOf(userAddress).call();
        const tokenBalanceFormatted = web3Instance.utils.fromWei(tokenBalance, 'ether');
        tokenBalanceElement.textContent = `${parseFloat(tokenBalanceFormatted).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
    } catch (e) {
        tokenBalanceElement.textContent = '获取失败';
    }
    
    // 显示模态框
    modal.classList.add('active');
}

// 关闭钱包信息模态框
function closeWalletModal() {
    const modal = document.getElementById('wallet-modal');
    modal.classList.remove('active');
}

// 处理账户变化
function handleAccountsChanged(accounts) {
    if (accounts.length === 0) {
        // 用户断开连接
        walletConnected = false;
        userAddress = null;
        web3Instance = null;
        updateWalletButton();
    } else if (accounts[0] !== userAddress) {
        // 用户切换账户
        connectWallet(accounts[0]);
    }
}

// 处理网络变化
function handleChainChanged(chainId) {
    // 网络变化时刷新页面
    window.location.reload();
}

// ==================== 领取最后买家奖励 ====================

// 领取最后买家奖励（调用 drawWinners）
async function claimLastBuyerReward() {
    if (!walletConnected || !userAddress) {
        alert('请先连接钱包！');
        return;
    }

    try {
        // 检查网络
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        if (chainId !== BSC_CHAIN_ID) {
            alert('请切换到 BSC 主网！');
            await switchToBSC();
            return;
        }

        // 创建合约实例
        const finalPoolContract = new web3Instance.eth.Contract(LOTTERY_ABI, FINAL_POOL_CONTRACT_ADDRESS);
        
        // 检查是否是中奖者
        try {
            const winner = await finalPoolContract.methods.winner().call();
            if (winner.toLowerCase() !== userAddress.toLowerCase()) {
                alert('❌ 您不是当前中奖者，无法领取奖励！\n\n当前中奖者: ' + winner.slice(0, 6) + '...' + winner.slice(-4));
                return;
            }
        } catch (e) {
            console.error('检查中奖者失败:', e);
        }
        
        // 显示加载提示
        const loadingMsg = document.createElement('div');
        loadingMsg.id = 'claim-loading';
        loadingMsg.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 30px 40px;
            border-radius: 15px;
            z-index: 3000;
            font-size: 1.1rem;
            font-weight: 600;
            text-align: center;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
        `;
        loadingMsg.innerHTML = '⏳ 领取中，请在钱包中确认交易...';
        document.body.appendChild(loadingMsg);

        // 调用 drawWinners 函数
        const tx = await finalPoolContract.methods.drawWinners().send({
            from: userAddress,
            gas: 300000 // 设置 gas limit
        });

        // 移除加载提示
        document.body.removeChild(loadingMsg);

        // 显示成功消息
        const successMsg = document.createElement('div');
        successMsg.style.cssText = loadingMsg.style.cssText.replace('rgba(0, 0, 0, 0.9)', 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)');
        successMsg.innerHTML = `
            ✅ 领取成功！<br>
            <a href="https://bscscan.com/tx/${tx.transactionHash}" 
               target="_blank" 
               style="color: #ffd700; text-decoration: underline; font-size: 0.9rem;">
               查看交易详情
            </a>
        `;
        document.body.appendChild(successMsg);

        // 3秒后移除成功消息并刷新数据
        setTimeout(() => {
            document.body.removeChild(successMsg);
            clearCountdown();
            loadLotteryInfo();
        }, 3000);

    } catch (error) {
        console.error('领取奖励失败:', error);
        
        // 移除加载提示（如果存在）
        const loadingMsg = document.getElementById('claim-loading');
        if (loadingMsg) {
            document.body.removeChild(loadingMsg);
        }

        // 显示错误消息
        let errorMessage = '领取失败，请重试';
        
        if (error.code === 4001) {
            errorMessage = '您取消了交易';
        } else if (error.message) {
            if (error.message.includes('not eligible') || error.message.includes('Not winner')) {
                errorMessage = '您不符合领取条件或不是中奖者';
            } else if (error.message.includes('countdown') || error.message.includes('too early')) {
                errorMessage = '倒计时尚未结束，请等待';
            } else if (error.message.includes('No reward') || error.message.includes('no prize')) {
                errorMessage = '暂无可领取的奖励';
            } else if (error.message.includes('already claimed')) {
                errorMessage = '奖励已被领取';
            }
        }
        
        alert('❌ ' + errorMessage);
    }
}