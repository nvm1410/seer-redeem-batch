import { zeroAddress } from "viem";
import { SUBGRAPHS } from "./constants.js";

const REALITY_TEMPLATE_SINGLE_SELECT = 2;
const REALITY_TEMPLATE_MULTIPLE_SELECT = 3;
export function getMarketType(market) {
    if (market.templateId === String(REALITY_TEMPLATE_SINGLE_SELECT)) {
        return "categorical";
    }

    if (market.templateId === String(REALITY_TEMPLATE_MULTIPLE_SELECT)) {
        return "multi_categorical";
    }

    if (market.questions.length > 1) {
        return "multi_scalar";
    }

    return "scalar";
}

export async function fetchMarkets(chainId) {
    const maxAttempts = 20;
    let attempt = 0;
    let allMarkets = [];
    let currentId = undefined;
    while (attempt < maxAttempts) {
        const query = `{
          markets(first: 1000, orderBy: id, orderDirection: asc${currentId ? `, where: {id_gt: "${currentId}"}` : ""
            }) {
            id
            type
            marketName
            outcomes
            templateId
            lowerBound
            upperBound
            questions{
            question {
                best_answer
            }
            }
            collateralToken
            collateralToken1
            collateralToken2
            outcomesSupply
            payoutReported
            payoutNumerators
            parentMarket{
              id
            }
            parentOutcome
            wrappedTokens
            creator
            finalizeTs
          }
        }`;
        const results = await fetch(SUBGRAPHS['seer'][chainId], {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                query,
            }),
        });
        const json = await results.json();
        const markets = (json?.data?.markets ?? []);
        allMarkets = allMarkets.concat(markets);

        if (markets[markets.length - 1]?.id === currentId) {
            break;
        }
        if (markets.length < 1000) {
            break; // We've fetched all markets
        }
        currentId = markets[markets.length - 1]?.id;
        attempt++;
    }
    return allMarkets.map((market) => ({
        ...market,
        parentMarket: market.parentMarket ?? { id: zeroAddress },
        chainId,
        marketType: getMarketType(market)
    }));
}