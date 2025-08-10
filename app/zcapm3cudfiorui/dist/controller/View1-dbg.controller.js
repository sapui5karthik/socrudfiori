sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/model/json/JSONModel"
], (Controller, MessageToast, MessageBox, JSONModel) => {
    "use strict";

    return Controller.extend("zcapm3cudfiorui.controller.View1", {
        onInit: function () { },

        _model: function () { return this.getView().getModel(); },

        _getSelectedOrderCtx: function () {
            const tbl = this.byId("tblOrders");
            const item = tbl.getSelectedItem();
            return item ? item.getBindingContext() : null;
        },

        _getSelectedItemCtx: function () {
            const tbl = this.byId("tblItems");
            const item = tbl.getSelectedItem();
            return item ? item.getBindingContext() : null;
        },

        _enableOrderButtons: function (enabled) {
            this.byId("btnUpdateOrder").setEnabled(enabled);
            this.byId("btnDeleteOrder").setEnabled(enabled);
            this.byId("btnCreateItem").setEnabled(enabled);
            // Item buttons depend on item selection
            this.byId("btnUpdateItem").setEnabled(false);
            this.byId("btnDeleteItem").setEnabled(false);
        },

        onOrderSelectionChange: function () {
            const orderItem = this.byId("tblOrders").getSelectedItem();
            const tblItems = this.byId("tblItems");
            if (!orderItem) {
                tblItems.unbindItems();
                this._enableOrderButtons(false);
                return;
            }

            const orderCtx = orderItem.getBindingContext(); // default model
            const path = orderCtx && orderCtx.getPath();    // e.g. /SalesOrders(ID=guid'...')
            if (!path) {
                sap.m.MessageBox.error("No context path for selected order.");
                return;
            }

            // IMPORTANT: Use the exact nav name from $metadata (default: 'items')
            tblItems.bindItems({
                path: `${path}/items`,
                template: tblItems.getItems()[0]?.clone ? tblItems.getItems()[0].clone() : undefined,
                parameters: { $$ownRequest: true } // forces its own GET; helpful for debugging
            });

            this._enableOrderButtons(true);
        },

        onItemSelectionChange: function () {
            const enabled = !!this._getSelectedItemCtx();
            this.byId("btnUpdateItem").setEnabled(enabled);
            this.byId("btnDeleteItem").setEnabled(enabled);
        },

        // ------- Orders CRUD -------
        onCreateOrder: function () {
            const customerID = this.byId("inpCustomer").getValue();
            const status = this.byId("inpStatus").getValue() || "NEW";
            const totalStr = this.byId("inpTotal").getValue();
            const total = totalStr ? Number(totalStr) : 0;

            if (!customerID) {
                MessageBox.error("Customer ID is required");
                return;
            }
            const model = this._model();
            const list = model.bindList("/SalesOrders");

            const ctx = list.create({ customerID, status, total });
            ctx.created().then(() => {
                MessageToast.show("Order created");
                this.byId("tblOrders").getBinding("items").refresh(); // re-read orders
               

            }
            )
                .catch(e => MessageBox.error("Create failed: " + (e.message || e)));
        },

        onUpdateOrder: function () {
            const ctx = this._getSelectedOrderCtx();
            if (!ctx) return MessageBox.information("Select an order");

            const status = this.byId("inpStatus").getValue();
            const totalStr = this.byId("inpTotal").getValue();

            if (!status && !totalStr) {
                return MessageBox.information("Enter Status and/or Total to update");
            }
            if (status) ctx.setProperty("status", status);
            if (totalStr) ctx.setProperty("total", Number(totalStr));

            MessageToast.show("Order updated"); // $auto submits automatically
        },

        onDeleteOrder: function () {
            const ctx = this._getSelectedOrderCtx();
            if (!ctx) return MessageBox.information("Select an order");

            MessageBox.confirm("Delete selected order (and its items)?", {
                onClose: (act) => {
                    if (act !== MessageBox.Action.OK) return;
                    ctx.delete().then(() => MessageToast.show("Order deleted"))
                        .catch(e => MessageBox.error("Delete failed: " + (e.message || e)));
                }
            });
        },

        // ------- Items CRUD via navigation binding -------
        onCreateItem: function () {
            const orderCtx = this._getSelectedOrderCtx();
            if (!orderCtx) return MessageBox.information("Select an order first");

            const productID = this.byId("inpProduct").getValue();
            const qtyStr = this.byId("inpQty").getValue();
            const priceStr = this.byId("inpPrice").getValue();
            const quantity = Number(qtyStr || 0);
            const price = Number(priceStr || 0);

            if (!productID) return MessageBox.error("Product ID is required");
            if (!(quantity > 0)) return MessageBox.error("Quantity must be > 0");
            if (price < 0) return MessageBox.error("Price must be >= 0");

            const model = this._model();
            const list = model.bindList(orderCtx.getPath() + "/items");
            const ctx = list.create({ productID, quantity, price });
            ctx.created().then(() => 
                {
                    MessageToast.show("Item added");
                     this.byId("tblItems").getBinding("items").refresh();  // re-read items
                }
                )
                .catch(e => MessageBox.error("Add item failed: " + (e.message || e)));
        },

        onUpdateItem: function () {
            const itemCtx = this._getSelectedItemCtx();
            if (!itemCtx) return MessageBox.information("Select an item");

            const qtyStr = this.byId("inpQty").getValue();
            const priceStr = this.byId("inpPrice").getValue();

            if (!qtyStr && !priceStr) return MessageBox.information("Enter Quantity and/or Price to update");

            if (qtyStr) itemCtx.setProperty("quantity", Number(qtyStr));
            if (priceStr) itemCtx.setProperty("price", Number(priceStr));

            MessageToast.show("Item updated"); // $auto
        },

        onDeleteItem: function () {
            const itemCtx = this._getSelectedItemCtx();
            if (!itemCtx) return MessageBox.information("Select an item");

            MessageBox.confirm("Delete the selected item?", {
                onClose: (act) => {
                    if (act !== MessageBox.Action.OK) return;
                    itemCtx.delete().then(() => MessageToast.show("Item deleted"))
                        .catch(e => MessageBox.error("Delete item failed: " + (e.message || e)));
                }
            });
        }
    });
});