sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageBox",
  "sap/ui/core/BusyIndicator",
  "sap/ui/core/format/DateFormat",
  "sap/ui/comp/valuehelpdialog/ValueHelpDialog",
  "sap/m/Token",
  "sap/ui/comp/filterbar/FilterBar",
  "sap/m/SearchField"
], function (
  Controller,
  JSONModel,
  MessageBox,
  BusyIndicator,
  DateFormat,
  ValueHelpDialog,
  Token,
  FilterBar,
  SearchField
) {
  "use strict";

  return Controller.extend("com.lvmh.apollo.zsyrusdataprepui.controller.Filters", {

    /* =========================================================== */
    /* INIT                                                        */
    /* =========================================================== */
    onInit: function () {
      var oModel = new JSONModel({ applyEnabled: false });
      this.getView().setModel(oModel, "reportModel");

      var oView = this.getView();
      var iYear = new Date().getFullYear();

      oView.byId("idGLAccountHierarchy").setValue("IFRS");
      oView.byId("idPostingDateFrom").setDateValue(new Date(iYear, 0, 1));
      oView.byId("idPostingDateTo").setDateValue(new Date(iYear, 11, 31));

      oView.getModel("reportModel").setProperty("/applyEnabled", true);
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

      oView.getModel("reportModel").setProperty("/applyEnabled", bEnable);
    },

    /* =========================================================== */
    /* GROUP ACCOUNT VALUE HELP                                    */
    /* =========================================================== */
    onGroupAccountValueHelp: function () {
      var oView = this.getView();
      var oMultiInput = oView.byId("idGroupAccountNumber");
      var oGroupAccountModel = this.getOwnerComponent().getModel("ZDDL_FI_GROUPACCOUNT_CDS");

      if (!oGroupAccountModel) {
        MessageBox.error("Group Account CDS model not found.");
        return;
      }

      if (!this._oGroupAccVHD) {

        // SEARCH FIELD
        var oSearchField = new SearchField({
          width: "100%",
          liveChange: function (oEvent) {
            var sValue = oEvent.getSource().getValue();
            var oTable = this._oGroupAccVHD.getTable();
            var oBinding = oTable.getBinding("rows");
            var aFilters = [];
            if (sValue) {
              aFilters.push(new sap.ui.model.Filter("bilkt", sap.ui.model.FilterOperator.Contains, sValue));
            }
            oBinding.filter(aFilters);
            this._updateGroupAccountCount();
          }.bind(this)
        });

        // FILTER BAR
        var oFilterBar = new FilterBar({
          advancedMode: false,
          filterBarExpanded: false,
          showGoOnFB: false,
          useToolbar: true
        });
        oFilterBar.setBasicSearch(oSearchField);

        // VALUE HELP DIALOG
        this._oGroupAccVHD = new ValueHelpDialog({
          title: "Group Account",
          supportMultiselect: true,
          supportRanges: false,
          key: "bilkt",
          descriptionKey: "bilkt",
          filterBar: oFilterBar,
          ok: function (oEvent) {
            oMultiInput.setTokens(oEvent.getParameter("tokens"));
            this.close();
          },
          cancel: function () { this.close(); },
          afterClose: function () {
            this.destroy();
            this._oGroupAccVHD = null;
          }.bind(this)
        });

        // TABLE
        this._oGroupAccVHD.getTableAsync().then(function (oTable) {
          oTable.setModel(oGroupAccountModel);
          oTable.bindRows("/ZDDL_FI_GROUPACCOUNT");
          oTable.addColumn(new sap.ui.table.Column({
            label: new sap.m.Label({ text: "Group Account Number" }),
            template: new sap.m.Text({ text: "{bilkt}" })
          }));
          oTable.getBinding("rows").attachDataReceived(function () {
            this._updateGroupAccountCount();
          }.bind(this));
        }.bind(this));
      }

      this._oGroupAccVHD.open();
      setTimeout(function () { this._updateGroupAccountCount(); }.bind(this), 0);
    },

    _updateGroupAccountCount: function () {
      if (!this._oGroupAccVHD) return;
      var oTable = this._oGroupAccVHD.getTable();
      var oBinding = oTable && oTable.getBinding("rows");
      if (!oBinding) return;
      this._oGroupAccVHD.setTitle("Group Account (" + oBinding.getLength() + ")");
    },

    /* =========================================================== */
    /* BUILD FILTER STRING FOR GET                                 */
    /* =========================================================== */
    _buildFilterString: function () {
      var oView = this.getView();
      var dDateFrom = oView.byId("idPostingDateFrom").getDateValue();
      var dDateTo = oView.byId("idPostingDateTo").getDateValue();
      var oDateFormat = DateFormat.getDateInstance({ pattern: "yyyy-MM-dd" });
      var sDateFrom = dDateFrom ? oDateFormat.format(dDateFrom) : null;
      var sDateTo = dDateTo ? oDateFormat.format(dDateTo) : null;

      var sFilter = "Companycode eq '" + oView.byId("idCompanyCodeBox").getValue() + "'" +
                    " and Ledger eq '" + oView.byId("idLedgerBox").getValue() + "'" +
                    " and Glaccounthier eq '" + oView.byId("idGLAccountHierarchy").getValue() + "'";

      if (sDateFrom) {
        sFilter += " and From_postingdate ge '" + sDateFrom + "'";
        sFilter += " and FiscalPeriod eq '" + String(dDateFrom.getMonth() + 1).padStart(2, "0") + "'";
      }
      if (sDateTo) {
        sFilter += " and To_postingdate le '" + sDateTo + "'";
        sFilter += " and FiscalYear eq '" + dDateTo.getFullYear() + "'";
      }

      var aTokens = oView.byId("idGroupAccountNumber").getTokens();
      if (aTokens.length) {
        var sOr = aTokens.map(function (t) { return "CorpgrpacctBefore eq '" + t.getKey() + "'"; }).join(" or ");
        sFilter += " and (" + sOr + ")";
      }

      console.log("===== APPLIED FILTER STRING =====");
      console.log(sFilter);
      console.log("=================================");
      return sFilter;
    },

    /* =========================================================== */
    /* APPLY FILTERS                                               */
    /* =========================================================== */
    onApplyFilters: function () {
      var oModel = this.getView().getModel();
      var sFilter = this._buildFilterString();

      // URL-encode the filter to ensure GET works
      var sFilterEncoded = encodeURIComponent(sFilter);
      console.log("Full GET URL:", "/SyrusSet?$filter=" + sFilterEncoded);

      BusyIndicator.show();

     oModel.read("/SyrusSet", {
  urlParameters: { "$filter": sFilter }, // do NOT encode
  success: function (oData) {
    MessageBox.success("Successfully processed");
    console.log(oData);
  },
  error: function (oError) {
    MessageBox.error(
      oError.responseText ? JSON.parse(oError.responseText).error.message.value : "Unknown error"
    );
  },
  complete: function () { BusyIndicator.hide(); }
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
      oView.getModel("reportModel").setProperty("/applyEnabled", false);
    }

  });
});
