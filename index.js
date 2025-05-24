import { fetchMarkets } from "./src/fetchMarkets.js";
import { getAllTransfers, getTokenHoldersAtTimestamp } from "./src/getAllTransfers.js";
import ethers from 'ethers'
import fs from 'fs'
import { parseToCsv } from './src/utils.js';
import transfers from './data/transfers.json' with { type: "json" };

const INVALID = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'

async function batchScalar(chainId) {
    const markets = await fetchMarkets(chainId)
    const now = (new Date().getTime()) / 1000
    const resolvedScalarMarkets = markets.filter(market => market.marketType === 'scalar' && market.finalizeTs < now)
    console.log(resolvedScalarMarkets.length)
    // get all tokens
    // get token balances before the finalizeTs
    // const transfers = await getAllTransfers(chainId)
    // percentage between the right and wrong answer
    const exportData = []
    for (const market of resolvedScalarMarkets) {
        const isBoundInWei = BigInt(market.upperBound) > BigInt(1e10)
        const realityAnswer = market.questions[0].question.best_answer
        if (realityAnswer === INVALID) {
            continue
        }
        const realityAnswerInInt = Number(ethers.utils.formatUnits(realityAnswer, 18))

        const isWrongPayout = (Number(market.upperBound) > realityAnswerInInt) && (Number(market.lowerBound) < realityAnswerInInt)
        if (!isBoundInWei && isWrongPayout) {
            const wrongPayout = market.payoutNumerators.map(x => Number(x))
            const correctPayout = []
            correctPayout[0] = (Number(market.upperBound) - realityAnswerInInt) / (Number(market.upperBound) - Number(market.lowerBound))
            correctPayout[1] = (realityAnswerInInt - Number(market.lowerBound)) / (Number(market.upperBound) - Number(market.lowerBound))
            correctPayout[2] = 0
            let wrongValue = {}
            let correctValue = {}
            for (let i = 0; i < market.wrappedTokens.length - 1; i++) {
                const token = market.wrappedTokens[i]
                const holders = getTokenHoldersAtTimestamp(transfers, market.finalizeTs, token)
                for (const [user, balance] of Object.entries(holders)) {
                    wrongValue[user] = (wrongValue[user] ?? 0) + balance * wrongPayout[i]
                    correctValue[user] = (correctValue[user] ?? 0) + balance * correctPayout[i]
                }
            }
            for (const user in Object(correctValue)) {
                if (wrongValue[user] !== correctValue[user]) {
                    exportData.push({
                        user,
                        market: market.id,
                        wrongValue: wrongValue[user],
                        correctValue: correctValue[user],
                    })
                }

            }
        }

    }
    const csv = parseToCsv(
        [
            { key: 'user', title: 'User' },
            { key: 'market', title: 'Market' },
            { key: 'wrongValue', title: 'Wrong Payout' },
            { key: 'correctValue', title: 'Correct Payout' },

        ], exportData)
    fs.writeFileSync(`./data/csv-${chainId}.csv`, csv)
}
batchScalar(100)