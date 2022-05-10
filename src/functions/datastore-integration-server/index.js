/* eslint-disable @typescript-eslint/no-var-requires */
const FoxyWebhook = require("../../foxy/FoxyWebhook.js");
const { config } = require("../../../config.js");
const fetch = require("node-fetch");

/**
 * @param {Object} event the request event built by Netlify Functions
 * @returns {Promise<{statusCode: number, body: string}>} the response object
 * */
exports.handler = async function(event) {
  //check env vars
  if (!validation.configuration.validate()){
    return validation.configuration.response()
  }
  //check event for correct format
  if (!validation.input.validate(event)) {
    return validation.input.response();
  }
  const items = extractItems(event.body);
  //check all items for correct format
  if (!validation.items.validate(items)) {
    return validation.items.response(items);
  }

  //items passed format checks
  //compare items against server
  try{
    for (const item of items) {
      //query server
      const response = await fetch(
        config.datastore.provider.server.apiEndpoint, {
          body: JSON.stringify({
            data_point_id: item._embedded["fx:item_options"].find(option => option.name === "pid").value,
            data_point_vid: item._embedded["fx:item_options"].find(option => option.name === "vid").value,
            price: item.price,
            quantity: item.quantity,
          }),
          cache: 'no-cache',
          headers: {
            'content-type': 'application/json'
          },
          method: 'POST',
          mode: 'cors'
        }
      );

      //check response
      if(response.status !== 200){
        const err = await response.text();
        console.error(err);
        return {
          body: JSON.stringify({ details: "Server failed to handle request", ok: false, }),
          statusCode: 500,
        }
      }

      //check if stock is available
      const json = await response.json();
      if(json.valid === false){
        return {
          body: JSON.stringify({ details: "Invalid item", ok: false, }),
          statusCode: 200,
        }
      }
    }

    //all items passed check
    console.log('OK: payment approved - items verified')
    return {
      body: JSON.stringify({ details: ' ', ok: true, }),
      statusCode: 200,
    }

  } catch (e) {
    console.error(e);
    return {
      body: JSON.stringify({ details: "An internal error has occurred", ok: false, }),
      statusCode: 500,
    };
  }
}

// noinspection SpellCheckingInspection
/**
 * Extract items from payload received from FoxyCart
 *
 * @param {string} body of the response received from Webflow
 * @returns {Array} an array of items
 */
function extractItems(body) {
  const objBody = JSON.parse(body);
  if (objBody && objBody._embedded && objBody._embedded['fx:items']) {
    return objBody._embedded['fx:items'];
  }
  return [];
}

/**
 * Checks if FoxyCart item is valid
 *
 * @param {Object} item to be validated
 * @returns {boolean} valid
 */
function validItem(item) {
  const errors = [];
  if (!(item.price || parseInt(item.price, 10) === 0)) {
    errors.push(`${item.name} has no price.`)
  }
  if (!(item.quantity || parseInt(item.quantity, 10) === 0)) {
    errors.push(`${item.name} has no quantity.`)
  }
  if (!item._embedded["fx:item_options"].find(option => option.name === "pid")){
    errors.push(`${item.name} has no pid.`)
  }
  if (!item._embedded["fx:item_options"].find(option => option.name === "vid")){
    errors.push(`${item.name} has no vid.`)
  }
  if (errors.length) {
    console.log("Invalid item ", item.name, errors.join(' '));
    return false;
  }
  return true;
}

/**
 * Validation checks
 */
const validation = {
  configuration: {
    response: () => ({
      body: JSON.stringify({ details: 'Server credentials were not provided.', ok: false }),
      statusCode: 503,
    }),
    validate: () => !!config.datastore.provider.server.apiID && !!config.datastore.provider.server.apiKey && !!config.datastore.provider.server.apiEndpoint,
  },
  input: {
    errorMessage: "",
    response: function() {
      return {
        body: JSON.stringify({ details: this.errorMessage, ok: false }),
        statusCode: 400,
      }
    },
    validate: function (requestEvent) {
      this.errorMessage = FoxyWebhook.validFoxyRequest(requestEvent);
      return !this.errorMessage;
    }
  },
  items: {
    response: (items) => ({
      body: JSON.stringify({
        details: `Invalid items: ${items.filter(e => !validItem(e)).map((e) => e.name).join(',')}`,
        ok: false,
      }),
      statusCode: 200,
    }),
    validate: (items) => items.every(e => validItem(e)),
  }
}
