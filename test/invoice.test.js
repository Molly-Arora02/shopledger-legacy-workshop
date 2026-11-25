var test = require('node:test');
var assert = require('node:assert/strict');

var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');

test('CURRENT BEHAVIOUR: invoice uses the 18% fallback instead of the HSN slab', function () {
  var items = [
    { id: 1, name: 'Rice', sku: 'GRN-001', hsn: '1006', price: 100, qty: 1 }
  ];
  var order = { items: items, coupon: '' };

  assert.deepEqual(invoice.computeInvoiceFigures(order), {
    subtotal: 100,
    discount: 0,
    tax: 18,
    cgst: 9,
    sgst: 9,
    total: 118,
    rows: [
      {
        name: 'Rice',
        sku: 'GRN-001',
        hsn: '1006',
        qty: 1,
        price: 100,
        gstPercent: 18,
        line: 100,
        lineTax: 18
      }
    ]
  });

  // Checkout resolves HSN 1006 to 5%; invoice.js does not.
  assert.equal(pricing.computeTotals(items, '').tax, 5);
});

test('CURRENT BEHAVIOUR: SAVE10 is calculated on subtotal plus tax and exceeds its cap', function () {
  var items = [
    { id: 5, name: 'Groundnut Oil', sku: 'OIL-002', hsn: '1508', price: 1120, qty: 2 }
  ];
  var order = { items: items, coupon: 'SAVE10' };

  var invoiceFigures = invoice.computeInvoiceFigures(order);
  assert.deepEqual(invoiceFigures, {
    subtotal: 2240,
    discount: 264.32,
    tax: 403.2,
    cgst: 201.6,
    sgst: 201.6,
    total: 2378.88,
    rows: [
      {
        name: 'Groundnut Oil',
        sku: 'OIL-002',
        hsn: '1508',
        qty: 2,
        price: 1120,
        gstPercent: 18,
        line: 2240,
        lineTax: 403.2
      }
    ]
  });

  // Checkout caps SAVE10 at 150 and applies the 5% HSN slab.
  var checkoutFigures = pricing.computeTotals(items, 'SAVE10');
  assert.equal(checkoutFigures.discount, 150);
  assert.equal(checkoutFigures.tax, 104.5);
  assert.equal(checkoutFigures.total, 2194.5);
  assert.notEqual(invoiceFigures.total, checkoutFigures.total);
});

test('CURRENT BEHAVIOUR: invoice applies an inactive coupon from config', function () {
  var order = {
    items: [
      { id: 1, name: 'Rice', sku: 'GRN-001', hsn: '1006', gstRate: 5, price: 1000, qty: 1 }
    ],
    coupon: 'DIWALI20'
  };

  assert.deepEqual(invoice.computeInvoiceFigures(order), {
    subtotal: 1000,
    discount: 210,
    tax: 50,
    cgst: 25,
    sgst: 25,
    total: 840,
    rows: [
      {
        name: 'Rice',
        sku: 'GRN-001',
        hsn: '1006',
        qty: 1,
        price: 1000,
        gstPercent: 5,
        line: 1000,
        lineTax: 50
      }
    ]
  });
});

test('CURRENT BEHAVIOUR: rendered invoice flags its total mismatch with the ledger', function () {
  var order = {
    id: 1004,
    date: '30/01/2022',
    status: 'completed',
    customer: 'Kalyani Foods',
    paymentMode: 'khata',
    coupon: 'SAVE10',
    total: 2194.5,
    items: [
      { id: 5, name: 'Groundnut Oil', sku: 'OIL-002', hsn: '1508', price: 1120, qty: 2 }
    ]
  };

  var html = invoice.render(order);
  assert.match(html, /Invoice computed total \(₹2378\.88\)/);
  assert.match(html, /Order Ledger recorded total \(₹2194\.50\)/);
  assert.match(html, /differs from Order Ledger recorded total/);
});
