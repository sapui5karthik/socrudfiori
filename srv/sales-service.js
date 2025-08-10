const cds = require('@sap/cds')

module.exports = cds.service.impl(async function () {
  const { SalesOrders, SalesItems } = this.entities

  // ---------- CREATE ----------
  this.before('CREATE', SalesOrders, ensureCreatePayload)
  this.on('CREATE',    SalesOrders, createOrder)          // custom create (optional)
  this.after('CREATE', SalesOrders, recalcTotals)

  // ---------- UPDATE (PATCH/MERGE) ----------
  this.before('UPDATE', SalesOrders, forbidClosedUpdates)
  this.on('UPDATE',     SalesOrders, updateOrder)         // custom update (optional)
  this.after('UPDATE',  SalesOrders, recalcTotals)

  // ---------- DELETE ----------
  this.before('DELETE', SalesOrders, forbidDeleteIfClosed)
  this.on('DELETE',     SalesOrders, cascadeDeleteItems)  // or soft delete
})
function ensureCreatePayload(req) {
    const { customerID, items } = req.data
    if (!customerID) req.error(400, 'customerID is required')
    if (!Array.isArray(items) || items.length === 0) {
      req.error(400, 'At least one item is required')
    }
    for (const [i, it] of items.entries()) {
      if (!it.productID) req.error(400, `items[${i}].productID required`)
      if (!(it.quantity > 0)) req.error(400, `items[${i}].quantity must be > 0`)
      if (!(it.price >= 0)) req.error(400, `items[${i}].price must be >= 0`)
    }
  }
  async function createOrder(req) {
    const tx = cds.tx(req)
    const { SalesOrders, SalesItems } = cds.entities('my')
    const { v4: uuid } = require('uuid')
  
    // Generate IDs and normalize
    const orderID = req.data.ID || uuid()
    const items = (req.data.items || []).map(it => ({
      ID: it.ID || uuid(),
      productID: it.productID,
      quantity: it.quantity,
      price: it.price,
      salesOrder_ID: orderID
    }))
  
    // Write in a single transaction
    await tx.run([
      INSERT.into(SalesOrders).entries({
        ID: orderID,
        customerID: req.data.customerID,
        status: 'NEW',
        total: 0       // will be recalculated in after hook
      }),
      ...items.map(e => INSERT.into(SalesItems).entries(e))
    ])
  
    // Return created entity (CAP will enrich with ETag)
    const created = await tx.run(
      SELECT.one.from(SalesOrders).where({ ID: orderID })
    )
    return created
  }
  async function recalcTotals(data, req) {
    // data is the entity object returned by CREATE/UPDATE
    const tx = cds.tx(req)
    const { SalesItems, SalesOrders } = cds.entities('my')
  
    const rows = await tx.run(
      SELECT.from(SalesItems).columns('quantity','price')
        .where({ salesOrder_ID: data.ID })
    )
    const total = rows.reduce((s, r) => s + (r.quantity * r.price), 0)
  
    await tx.run(
      UPDATE(SalesOrders).set({ total }).where({ ID: data.ID })
    )
  }
  async function forbidClosedUpdates(req) {
    const { SalesOrders } = cds.entities('my')
    const tx = cds.tx(req)
  
    // req.data has fields being patched; req.params has keys (ID)
    const { ID } = req.params[0] || {}
    if (!ID) return
  
    const cur = await tx.run(SELECT.one.from(SalesOrders).columns('status').where({ ID }))
    if (!cur) req.reject(404, 'Order not found')
  
    if (cur.status === 'CLOSED' || cur.status === 'CANCELED') {
      req.reject(409, 'Closed/Canceled orders cannot be modified')
    }
  }
  async function updateOrder(req) {
    const tx = cds.tx(req)
    const { SalesOrders } = cds.entities('my')
    const key = req.params[0]                 // { ID: ... }
    const patch = req.data                    // only changed fields
  
    // Example: normalize/validate status change
    if (patch.status && !['NEW','OPEN','CLOSED','CANCELED'].includes(patch.status)) {
      req.error(400, 'Invalid status')
    }
  
    await tx.run(UPDATE(SalesOrders).set(patch).where(key))
  
    // Return the latest row
    return tx.run(SELECT.one.from(SalesOrders).where(key))
  }
  async function replaceItems(req, orderID, items) {
    const tx = cds.tx(req)
    const { SalesItems } = cds.entities('my')
  
    // Replace strategy: delete + insert
    await tx.run(DELETE.from(SalesItems).where({ salesOrder_ID: orderID }))
    if (Array.isArray(items) && items.length) {
      await tx.run(items.map(it =>
        INSERT.into(SalesItems).entries({
          ID: it.ID || require('uuid').v4(),
          productID: it.productID,
          quantity: it.quantity,
          price: it.price,
          salesOrder_ID: orderID
        })
      ))
    }
  }
  async function forbidDeleteIfClosed(req) {
    const tx = cds.tx(req)
    const { SalesOrders } = cds.entities('my')
    const { ID } = req.params[0] || {}
    if (!ID) return
  
    const row = await tx.run(SELECT.one.from(SalesOrders).columns('status').where({ ID }))
    if (!row) req.reject(404, 'Order not found')
    if (row.status === 'CLOSED') req.reject(409, 'Closed orders cannot be deleted')
  }
  async function cascadeDeleteItems(req) {
    const tx = cds.tx(req)
    const { SalesItems, SalesOrders } = cds.entities('my')
    const key = req.params[0]
  
    await tx.run(DELETE.from(SalesItems).where({ salesOrder_ID: key.ID }))
    await tx.run(DELETE.from(SalesOrders).where(key))
  }
  async function softDelete(req) {
    const tx = cds.tx(req)
    const { SalesOrders } = cds.entities('my')
    const key = req.params[0]
    await tx.run(UPDATE(SalesOrders).set({ isDeleted: true }).where(key))
    return
  }
  