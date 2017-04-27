/**
 * Yahoo Finance API adapter.
 */

var util = require('util');
var request = require('request-promise-native');
var xml2js = require('xml2js');
var et = require('elementtree');
var ApiError = require('./errors').ApiError;


const BOT_STOCK_URL = 'http://finance.yahoo.com/webservice/v1/symbols/%s/quote';

const BOT_RANGE_URL = 'http://query.yahooapis.com/v1/public/yql?q=select%%20*%%20from%%20yahoo.finance'
    + '.quotes%%20where%%20symbol%%20in%%20(%s)&env=store://datatables.org/alltableswithkeys';

// Samsung Galaxy S6
const BOT_USER_AGENT_STR = 'Mozilla/5.0 (Linux; Android 6.0.1; SM-G920V Build/MMB29K) AppleWebKit/537.36 '
    + '(KHTML, like Gecko) Chrome/52.0.2743.98 Mobile Safari/537.36';

function stock(companyCode) {
    if (!companyCode) {
        return Promise.reject(new ApiError('Company code not provided.', 'BOT02'));
    }

    let url = null;

    try {
        url = util.format(BOT_STOCK_URL, encodeURIComponent(companyCode));
    } catch (uriError) {
        let message = `Error creating URL to query stock information of company ${companyCode}.`;
        return Promise.reject(new ApiError(message, 'BOT03', uriError));
    }

    let reqOptions = {
        method: 'GET',
        uri: url,
        headers: {'User-Agent': BOT_USER_AGENT_STR}
    };

    return request.get(reqOptions).then((response) => new Promise((resolve, reject) => {
        xml2js.parseString(response, function (err, content) {
            if (err) {
                reject(new ApiError('Error parsing response from server.', 'BOT03', err));
                return;
            }
            resolve(content);
        });
    }).then((content) => {
        // Test to see if the object returned has resources.
        if (!content.list || !content.list.resources) {
            // TODO: convert console.error to a debug using winston.
            console.error('Invalid response: ' + JSON.stringify(content));
            throw new ApiError('Unexpected response from Yahoo Api.', 'BOT03');
        } else if (content.list.resources.length < 1) {
            // TODO: convert console.error to a debug using winston.
            console.error('No resources found...: ' + JSON.stringify(content));
            throw new ApiError(`Could not find information for company ${companyCode}.`, 'BOT02');
        }

        let resource = content.list.resources[0].resource[0];
        let name = null, price = null;

        // Get the values of the name and price tags of the response.
        // TODO: Ugly API, try with a element-tree compatible library.
        for (let field of resource.field) {
            if (field.$.name === 'name') {
                name = field._;
            } else if (field.$.name === 'price') {
                price = field._;
            }
        }

        if (!(name || resource)) {
            throw new ApiError('Stock API returned answer without name or price fields.', 'BOT03');
        }

        return {
            companyCode, 'name': name, price: parseFloat(price),
            message: `${companyCode} (${name}) quote is \$${price} per share.`, error: false, lang: 'en'
        };
    })).catch(function (error) {
        throw new ApiError(`Error connecting to the Yahoo Finance API to query information about company ${companyCode}`,
            'BOT03', error);
    });
}

/***
 * This function queries the  Yahoo! Finance API to get stock ranges.
 * @param args Company code to query, or an array of company codes.
 */
function dayRange(args) {
    if (!args) {
        return Promise.reject(new ApiError('Company code not provided.', 'BOT02'));
    }

    let queryCode = null;
    if (args instanceof Array) {
        queryCode = Array.join(args.map((item) => `"${item}"`));
    } else {
        queryCode = `"${args}"`;
    }

    let url = null;

    try {
        url = util.format(BOT_RANGE_URL, encodeURIComponent(queryCode));
    } catch (uriError) {
        let message = `Error creating URL to query stock information of company ${queryCode}.`;
        return Promise.reject(new ApiError(message, 'BOT03', uriError));
    }

    let reqOptions = {
        method: 'GET',
        uri: url
    };

    return request.get(reqOptions).then((response) => {
        let doc = et.parse(response);
        let quotes = doc.findall('.//quote');

        if (!quotes) {
            throw new ApiException('Unexpected response from Yahoo Ranges API.', 'BOT03');
        }

        // This API always returns a result, even when the code is incorrect. We can check if the
        // company code is valid by inspecting certain fields in the answer. If they are empty,
        // we assume there is no information associated with the company ID given.
        let results = [];

        for (quote of quotes) {
            try {
                let companyName = quote.find('Name').text;
                let daysLow = quote.find('DaysLow').text;
                let daysHigh = quote.find('DaysHigh').text;
                let code = quote.attrib['symbol'];

                if (!(companyName && daysLow && daysHigh && code)) {
                    // TODO: Replace with logger.debug
                    console.error(`Incomplete information from Yahoo Finance Ranges API: ${code} ${companyName} ${daysLow} ${daysHigh}`);
                    results.push({error: true, message: `Could not find information for company ${code}.`});
                    continue;
                }

                results.push({companyCode: code, name: companyName, error: false, lang: 'en',
                    'daysLow': parseFloat(daysLow), daysHigh: parseFloat(daysHigh),
                    'message': `${code} (${companyName}) Days Low quote is \$${daysLow} and Days High is \$${daysHigh}.`});
            } catch (err) {
                // TODO: Replace with logger.debug
                let message = `Error getting data for company ${quote.attrib.symbol || ''}`;
                console.error(message);
                console.error(err);
                results.append({error: true, message});
            }
        }

        return {error: false, results};
    }).catch((err) => {
        // Wrap exception
        let msg = `Error getting data from Yahoo Finance Ranges API for company ${queryCode}.`;
        throw new ApiException(msg, code='BOT03');
    });
}

// return a registry of the supported message types.
module.exports = {
    stock,
    day_range: dayRange
};