/**
 * Yahoo Finance API adapter.
 */

const BOT_STOCK_URL = 'http://finance.yahoo.com/webservice/v1/symbols/%s/quote';

const BOT_RANGE_URL = 'http://query.yahooapis.com/v1/public/yql?q=select%%20*%%20from%%20yahoo.finance'
    + '.quotes%%20where%%20symbol%%20in%%20({0})&env=store://datatables.org/alltableswithkeys';

// Samsung Galaxy S6
const BOT_USER_AGENT_STR = 'Mozilla/5.0 (Linux; Android 6.0.1; SM-G920V Build/MMB29K) AppleWebKit/537.36 '
    + '(KHTML, like Gecko) Chrome/52.0.2743.98 Mobile Safari/537.36';

// return a registry of the supported message types.
module.exports = {
    stock: function (companyCode) {
        //TODO: Implement connection to Yahoo using request-promise
        // https://blog.risingstack.com/node-hero-node-js-request-module-tutorial/
    }
};