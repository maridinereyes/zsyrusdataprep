sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageBox",
  "sap/ui/core/BusyIndicator",
  "sap/ui/core/format/DateFormat",
  "sap/ui/comp/valuehelpdialog/ValueHelpDialog",
  "sap/m/Token",
  "sap/ui/comp/filterbar/FilterBar",
  "sap/m/SearchField",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator"
], function (
  Controller,
  JSONModel,
  MessageBox,
  BusyIndicator,
  DateFormat,
  ValueHelpDialog,
  Token,
  FilterBar,
  SearchField,
  Filter,
  FilterOperator
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

      this.getView()
        .getModel("reportModel")
        .setProperty("/applyEnabled", bEnable);
    },

    /* =========================================================== */
    /* GROUP ACCOUNT VALUE HELP (SEARCH + LIVE COUNT)              */
    /* =========================================================== */
    onGroupAccountValueHelp: function () {
      var oView = this.getView();
      var oMultiInput = oView.byId("idGroupAccountNumber");

      var oGroupAccountModel =
        this.getOwnerComponent().getModel("ZDDL_FI_GROUPACCOUNT_CDS");

      if (!oGroupAccountModel) {
        MessageBox.error("Group Account CDS model not found in manifest.");
        return;
      }

      if (!this._oGroupAccVHD) {

        /* ================= SEARCH FIELD ================= */
        var oSearchField = new SearchField({
          width: "100%",
          liveChange: function (oEvent) {
            var sValue = oEvent.getSource().getValue();
            var oTable = this._oGroupAccVHD.getTable();
            var oBinding = oTable.getBinding("rows");

            var aFilters = [];
            if (sValue) {
              aFilters.push(
                new Filter("bilkt", FilterOperator.Contains, sValue)
              );
            }

            oBinding.filter(aFilters);

            
            this._updateGroupAccountCount();
          }.bind(this)
        });

        /* ================= FILTER BAR ================= */
        var oFilterBar = new FilterBar({
          advancedMode: false,
          filterBarExpanded: false,
          showGoOnFB: false,
          useToolbar: true
        });

        oFilterBar.setBasicSearch(oSearchField);

        /* ================= VALUE HELP DIALOG ================= */
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

          cancel: function () {
            this.close();
          },

          afterClose: function () {
            this.destroy();
            this._oGroupAccVHD = null;
          }.bind(this)
        });

        /* ================= TABLE SETUP ================= */
        this._oGroupAccVHD.getTableAsync().then(function (oTable) {
          oTable.setModel(oGroupAccountModel);
          oTable.bindRows("/ZDDL_FI_GROUPACCOUNT");

          oTable.addColumn(
            new sap.ui.table.Column({
              label: new sap.m.Label({ text: "Group Account Number" }),
              template: new sap.m.Text({ text: "{bilkt}" })
            })
          );

        
          oTable.getBinding("rows").attachDataReceived(function () {
            this._updateGroupAccountCount();
          }.bind(this));

        }.bind(this));
      }

      this._oGroupAccVHD.open();

     
      setTimeout(function () {
        if (this._oGroupAccVHD) {
          this._updateGroupAccountCount();
        }
      }.bind(this), 0);
    },

    /* =========================================================== */
    /* UPDATE VALUE HELP ITEM COUNT                                */
    /* =========================================================== */
    _updateGroupAccountCount: function () {
      if (!this._oGroupAccVHD) {
        return;
      }

      var oTable = this._oGroupAccVHD.getTable();
      var oBinding = oTable && oTable.getBinding("rows");

      if (!oBinding) {
        return;
      }

      var iCount = oBinding.getLength();
      this._oGroupAccVHD.setTitle("Group Account (" + iCount + ")");
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
        return oToken.getKey();
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

      this._createSyrusEntry(oPayload)
        .then(function (oResponse) {
          if (oResponse.sapMessage &&
              oResponse.sapMessage.severity === "warning") {
            MessageBox.warning(oResponse.message);
            return;
          }
          MessageBox.success("Successfully Updated");
        })
        .catch(function (oErrorMessage) {
          MessageBox.error(oErrorMessage);
        })
        .finally(function () {
          BusyIndicator.hide();
        });
    },

    /* =========================================================== */
    /* ODATA CREATE PROMISE                                        */
    /* =========================================================== */
    _createSyrusEntry: function (oPayload) {
      var oModel = this.getView().getModel();

      return new Promise(function (resolve, reject) {
        oModel.create("/SyrusSet", oPayload, {
          success: function (oData, oResponse) {
            var oResult = { sapMessage: null, message: "" };

            if (oResponse.headers && oResponse.headers["sap-message"]) {
              var oMsg = JSON.parse(oResponse.headers["sap-message"]);
              if (oMsg.severity === "warning") {
                oResult.sapMessage = oMsg;
                oResult.message =
                  (oMsg.details || []).map(d => d.message).join("\n") ||
                  oMsg.message;
              }
            }
            resolve(oResult);
          },
          error: function (oError) {
            reject(JSON.parse(oError.responseText).error.message.value);
          }
        });
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

      this.getView()
        .getModel("reportModel")
        .setProperty("/applyEnabled", false);
    }

  });
});
