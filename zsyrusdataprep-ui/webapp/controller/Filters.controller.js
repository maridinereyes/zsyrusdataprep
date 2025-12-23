sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageBox",
  "sap/ui/core/BusyIndicator",
  "sap/ui/core/format/DateFormat",
  "sap/ui/comp/valuehelpdialog/ValueHelpDialog",
  "sap/m/Token"
], function (
  Controller,
  JSONModel,
  MessageBox,
  BusyIndicator,
  DateFormat,
  ValueHelpDialog,
  Token
) {
  "use strict";

  return Controller.extend("com.lvmh.apollo.zsyrusdataprepui.controller.Filters", {

    /* =========================================================== */
    /* INIT                                                       */
    /* =========================================================== */

    onInit: function () {
      var oModel = new JSONModel({
        applyEnabled: false
      });
      this.getView().setModel(oModel, "reportModel");

      var oView = this.getView();
      var iYear = new Date().getFullYear();

      oView.byId("idGLAccountHierarchy").setValue("IFRS");
      oView.byId("idPostingDateFrom").setDateValue(new Date(iYear, 0, 1));
      oView.byId("idPostingDateTo").setDateValue(new Date(iYear, new Date().getMonth(), 0));

      this.getView().getModel("reportModel").setProperty("/applyEnabled", true);
    },

    /* =========================================================== */
    /* FILTER CHANGE                                               */
    /* =========================================================== */

    onFilterChange: function () {
      var oView = this.getView();

      var bEnable = !!(
        oView.byId("idCompanyCodeBox").getValue() &&
        oView.byId("idLedgerBox").getValue() &&
        oView.byId("idGLAccountHierarchy").getValue() &&
        oView.byId("idPostingDateFrom").getDateValue() &&
        oView.byId("idPostingDateTo").getDateValue()
      );

      this.getView().getModel("reportModel").setProperty("/applyEnabled", bEnable);
    },

    /* =========================================================== */
    /* GROUP ACCOUNT VALUE HELP                                    */
    /* =========================================================== */

    onGroupAccountValueHelp: function () {
  var oView = this.getView();
  var oMultiInput = oView.byId("idGroupAccountNumber");

  // ✅ get the correct named model from manifest
  var oGroupAccountModel = this.getOwnerComponent().getModel("ZDDL_FI_GROUPACCOUNT_CDS");

  if (!oGroupAccountModel) {
    MessageBox.error("Group Account CDS model not found in manifest.");
    return;
  }

  if (!this._oGroupAccVHD) {
    this._oGroupAccVHD = new ValueHelpDialog({
      title: "Group Account",
      supportMultiselect: true,
      supportRanges: false,
      key: "bilkt",
      descriptionKey: "bilkt",

      ok: function (oEvent) {
        oMultiInput.setTokens(oEvent.getParameter("tokens"));
        this.close();
      },

      cancel: function () {
        this.close();
      },

      afterClose: function () {
        this.destroy();
        this._oGroupAccVHD = null;
      }.bind(this)
    });

    this._oGroupAccVHD.getTableAsync().then(function (oTable) {

      // ✅ THIS is the critical line
      oTable.setModel(oGroupAccountModel);

      // sap.ui.table.Table requires bindRows
      oTable.bindRows("/ZDDL_FI_GROUPACCOUNT");

      oTable.addColumn(new sap.ui.table.Column({
        label: new sap.m.Label({ text: "Group Account Number" }),
        template: new sap.m.Text({ text: "{bilkt}" })
      }));
    });
  }

  this._oGroupAccVHD.open();
},


    /* =========================================================== */
    /* APPLY FILTERS                                               */
    /* =========================================================== */

    onApplyFilters: function () {
      var oView = this.getView();

      var sCompanyCode = oView.byId("idCompanyCodeBox").getValue();
      var sLedger = oView.byId("idLedgerBox").getValue();
      var sGLHierarchy = oView.byId("idGLAccountHierarchy").getValue();
      var dDateFrom = oView.byId("idPostingDateFrom").getDateValue();
      var dDateTo = oView.byId("idPostingDateTo").getDateValue();

      if (!sCompanyCode || !sLedger || !sGLHierarchy || !dDateFrom || !dDateTo) {
        MessageBox.error("Please fill in all required fields.");
        return;
      }

      var aTokens = oView.byId("idGroupAccountNumber").getTokens();
      var sGroupAccounts = aTokens.map(function (oToken) {
        return oToken.getKey(); // bilkt
      }).join(",");

      var oDateFormat = DateFormat.getDateInstance({ pattern: "yyyy-MM-dd" });

      var oPayload = {
        Companycode: sCompanyCode,
        Ledger: sLedger,
        Glaccounthier: sGLHierarchy,
        From_postingdate: oDateFormat.format(dDateFrom),
        To_postingdate: oDateFormat.format(dDateTo),
        FiscalPeriod: String(dDateFrom.getMonth() + 1).padStart(2, "0"),
        FiscalYear: String(dDateTo.getFullYear()),
        CorpgrpacctBefore: sGroupAccounts,
        CorpgracctAfter: ""
      };

      BusyIndicator.show();

      this.getView().getModel().create("/SyrusSet", oPayload, {
        success: function (oData, oResponse) {
          BusyIndicator.hide();

          if (oResponse.headers && oResponse.headers["sap-message"]) {
            var oMsg = JSON.parse(oResponse.headers["sap-message"]);

            if (oMsg.severity === "warning") {
              MessageBox.warning(
                oMsg.details.map(function (d) {
                  return d.message;
                }).join("\n")
              );
              return;
            }
          }

          MessageBox.success("Successfully Updated");
        },

        error: function (oError) {
          BusyIndicator.hide();
          MessageBox.error(
            JSON.parse(oError.responseText).error.message.value
          );
        }
      });
    },

    /* =========================================================== */
    /* CLEAR FILTERS                                               */
    /* =========================================================== */

    onClearFilters: function () {
      var oView = this.getView();

      oView.byId("idLedgerBox").setValue("GG");
      oView.byId("idCompanyCodeBox").setValue("LVMH");
      oView.byId("idGLAccountHierarchy").setValue("");
      oView.byId("idGroupAccountNumber").removeAllTokens();
      oView.byId("idPostingDateFrom").setDateValue(null);
      oView.byId("idPostingDateTo").setDateValue(null);

      this.getView().getModel("reportModel").setProperty("/applyEnabled", false);
    }

  });
});
