const config = require('../../config.js');


/**
 * @typedef {Object} CanonicalItem
 * @property {string} name the anme of the product
 * @property {number|undefined} price the product price
 * @property {number|undefined} inventory the amount available in the inventory.
 * @property {string} code the unique code of the product (sku)
 * @property {string|undefined} parent_code the code of the parent product if
 *  it exists.
 */


class CartValidator {

  skipCodes = {
    inventory: [],
    price: [],
  }

  /** 
   * Configure the Cart Validator to skip validating a code.
   *
   * @param {string} code
   */
  skipInventory(code) {
    this.skipCodes.inventory.push(code);
  }

  skipPrice(code) {
    this.skipCodes.price.push(code);
  }

  /**
   * Autoconfigures the instance to skip the validation of prices and inventory
   * of items with codes listed in the configured environment variables.
   */
  skipFromEnv() {
    (config.datastore.skipCode.price || '').split(',').forEach(this.skipPrice.bind(this));
    (config.datastore.skipCode.inventory || '').split(',').forEach(this.skipPrice.bind(this));
  }

  /**
   * Validates a cartItem has the correct inventory according to a canonical
   * item.
   *
   * @param {Object} cartItem to be validated against a canonical item.
   * @param {CanonicalItem} canonicalItem to validate the cartItem.
   * @returns {boolean} price is valid.
   *
   */
  validPrice(cartItem, canonicalItem) {
    return this.skipCodes.price.includes(cartItem.code) ||
      !canonicalItem.price ||
      parseFloat(cartItem.price) === parseFloat(canonicalItem.price);
  }

  /**
   * Validates a cartItem has the correct price according to a canonical item.
   *
   * @param {import('./FoxyWebhook.js').PrepaymentItem} cartItem the cart item to be validated.
   * @param {CanonicalItem} canonicalItem the canonical against which the cart
   * item will be validated.
   * @returns {boolean} the inventory is sufficient for this purchase.
   */
  validInventory(cartItem, canonicalItem) {
    return this.skipCodes.inventory.includes(cartItem.code) ||
      !cartItem.quantity ||
      canonicalItem.inventory === undefined ||
      Number(cartItem.quantity) <= Number(canonicalItem.inventory);
  }
}

module.exports = CartValidator;
