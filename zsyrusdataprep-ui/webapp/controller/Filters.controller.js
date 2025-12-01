sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageBox",
  "sap/ui/core/BusyIndicator",
  "sap/ui/core/format/DateFormat"
], function (Controller, JSONModel, MessageBox, BusyIndicator, DateFormat) {
  "use strict";

  return Controller.extend("com.lvmh.apollo.zsyrusdataprepui.controller.Filters", {

    onInit: function () {
      // Model to control Apply button
      var oModel = new JSONModel({
        applyEnabled: false
      });
      this.getView().setModel(oModel, "reportModel");

      //set default value
      var oView = this.getView();
      const firstDayOfYear = new Date(new Date().getFullYear(), 0, 1);
      const lastDayPrevMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 0);
      
      oView.byId("idGLAccountHierarchy").setValue("IFRS");
      oView.byId("idPostingDateFrom").setDateValue(firstDayOfYear);
      oView.byId("idPostingDateTo").setDateValue(lastDayPrevMonth);
      this.getView().getModel("reportModel").setProperty("/applyEnabled", true);


    },

    onFilterChange: function () {
      var oView = this.getView();
      var sCompanyCode = oView.byId("idCompanyCodeBox").getValue();
      var sLedger = oView.byId("idLedgerBox").getValue();
      var sGLHierarchy = oView.byId("idGLAccountHierarchy").getValue();
      var dDateFrom = oView.byId("idPostingDateFrom").getDateValue();
      var dDateTo = oView.byId("idPostingDateTo").getDateValue();

      // Enable Apply button only if required fields filled
      var bEnable = !!(sCompanyCode && sLedger && sGLHierarchy && dDateFrom && dDateTo);
      this.getView().getModel("reportModel").setProperty("/applyEnabled", bEnable);
    },

    onApplyFilters: function () {
      var oView = this.getView();

      var sCompanyCode = oView.byId("idCompanyCodeBox").getValue();
      var sLedger = oView.byId("idLedgerBox").getValue();
      var sGLHierarchy = oView.byId("idGLAccountHierarchy").getValue();
      var sGroupAccount = oView.byId("idGroupAccountNumber").getValue();
      var dDateFrom = oView.byId("idPostingDateFrom").getDateValue();
      var dDateTo = oView.byId("idPostingDateTo").getDateValue();

      if (!sCompanyCode || !sLedger || !sGLHierarchy || !dDateFrom || !dDateTo) {
        MessageBox.error("Please fill in all required fields.");
        return;
      }

      var oDateFormat = DateFormat.getDateInstance({
        pattern: "yyyy-MM-dd"
      });
      var sDateFrom = oDateFormat.format(dDateFrom);
      var sDateTo = oDateFormat.format(dDateTo);
      var sFiscalPeriod = String(dDateFrom.getMonth() + 1).padStart(2, "0");
      var sFiscalYear = String(dDateTo.getFullYear());

      var oPayload = {
        Companycode: sCompanyCode,
        Ledger: sLedger,
        Glaccounthier: sGLHierarchy,
        From_postingdate: sDateFrom,
        To_postingdate: sDateTo,
        FiscalPeriod: sFiscalPeriod,
        FiscalYear: sFiscalYear,
        CorpgrpacctBefore: sGroupAccount || "",
        CorpgracctAfter: ""
      };

      BusyIndicator.show();
      this.getView().getModel().create("/SyrusSet", oPayload, {
        success: function (oData, oResponse) {
          BusyIndicator.hide();
          var oResponseMsg = JSON.parse(oResponse.headers["sap-message"]);
          var aMessages = oResponseMsg.details;
          if (oResponseMsg.severity === "warning"){
            MessageBox.warning(
              aMessages.map(function(o){ return o.message; }).join("\n")
            );
          }else{
            // Success logic
          MessageBox.success("Successfully Updated");
          }
          
        }.bind(this),
        error: function (oError) {
          BusyIndicator.hide();
          var oResponse = JSON.parse(oError.responseText);
          var sMessageText = oResponse.error.message.value;
          MessageBox.error(sMessageText);
        }
      });
    }
    ,

    onClearFilters: function () {
      var oView = this.getView();
      oView.byId("idLedgerBox").setValue("GG");
      oView.byId("idCompanyCodeBox").setValue("LVMH");
      oView.byId("idGLAccountHierarchy").setValue("");
      oView.byId("idGroupAccountNumber").setValue("");
      oView.byId("idPostingDateFrom").setDateValue(null);
      oView.byId("idPostingDateTo").setDateValue(null);

      this.getView().getModel("reportModel").setProperty("/applyEnabled", false);
    }

  });
});
