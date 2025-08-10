sap.ui.define([
    "sap/ui/core/UIComponent",
    "zcapm3cudfiorui/model/models"
], (UIComponent, models) => {
    "use strict";

    return UIComponent.extend("zcapm3cudfiorui.Component", {
        metadata: {
            manifest: "json",
            interfaces: [
                "sap.ui.core.IAsyncContentCreation"
            ]
        },

        init() {
            // call the base component's init function
            UIComponent.prototype.init.apply(this, arguments);

            // set the device model
            this.setModel(models.createDeviceModel(), "device");

            // enable routing
            this.getRouter().initialize();
        }
    });
});