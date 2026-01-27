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
  "sap/ui/model/FilterOperator",
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

      oView.getModel("reportModel").setProperty("/applyEnabled", true);
      this._mSavedVariants = {};
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
          supportRanges: true,
          key: "bilkt",
          descriptionKey: "bilkt",
          rangeKeyFields: [
            {
              label: "Group Account Number",
              key: "bilkt",
              type: "string"
            }
          ],
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

        this._oGroupAccVHD.setRangeKeyFields([
          {
            label: "Group Account Number",
            key: "bilkt",
            type: "string"
          }
        ]);


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
        var aConditions = [];

        aTokens.forEach(function (oToken) {
          var oRange = oToken.data && oToken.data.range;

          if (oRange) {

            if (oRange.operation === "BT") {
              aConditions.push(
                "(CorpgrpacctBefore ge '" + oRange.value1 +
                "' and CorpgrpacctBefore le '" + oRange.value2 + "')"
              );
            }


            if (oRange.operation === "EQ") {
              aConditions.push(
                "CorpgrpacctBefore eq '" + oRange.value1 + "'"
              );
            }
          } else {

            aConditions.push(
              "CorpgrpacctBefore eq '" + oToken.getKey() + "'"
            );
          }
        });

        sFilter += " and (" + aConditions.join(" or ") + ")";
      }


      console.log("===== APPLIED FILTER STRING =====");
      console.log(sFilter);
      console.log("=================================");
      return sFilter;
    },

    /* =========================================================== */
    /* APPLY FILTERS                                               */
    /* =========================================================== */
    onApplyFilters: function (oEvent) {
      var oModel = this.getView().getModel();
      // var sFilter = this._buildFilterString();
      var aFilters = this._getFilters();
      var oBundle = this.getOwnerComponent()
        .getModel("i18n")
        .getResourceBundle();

      var sMessage = oBundle.getText("successMsginwarning");
      var sSuccessMessage = oBundle.getText("successMsgwithoutwarning");


      BusyIndicator.show(0);
     


      oModel.read("/SyrusSet", {
        
        filters: aFilters,
        success: function (oData, oResponse) {


          BusyIndicator.hide();

          var oResult = {};
          var sSapMessage = oResponse && oResponse.headers && oResponse.headers["sap-message"];

          if (sSapMessage) {
            try {
              var oMsg = JSON.parse(sSapMessage);
              var aDetails = oMsg.details || [];

              var sBackendMsg = "";

              if (aDetails.length > 0) {
                sBackendMsg = aDetails
                  .map(function (d) {
                    return d.message;
                  })
                  .join("\n");
              } else {
                sBackendMsg = oMsg.message || "";
              }

              oResult.sapMessage = oMsg;

              switch (oMsg.severity) {
                case "error":
                  MessageBox.error(sBackendMsg);
                  break;

                case "warning":
                  MessageBox.warning(
                    sMessage + "\n\n" + sBackendMsg
                  );
                  break;

                case "success":
                  MessageBox.success(
                    sSuccessMessage + "\n\n" + sBackendMsg
                  );
                  break;

                default:
                  MessageBox.information(
                    sSuccessMessage + "\n\n" + sBackendMsg
                  );
              }

            } catch (e) {
              MessageBox.success(sSuccessMessage);
            }

          } else {
            MessageBox.success(sSuccessMessage);
          }



          console.log("OData result:", oData);
          console.log("SAP Message Object:", oResult.sapMessage);
        }
        ,
        error: function (oError) {
          BusyIndicator.hide();
          MessageBox.error(
            oError.responseText ? JSON.parse(oError.responseText).error.message.value : "Unknown error"
          );
        },
        complete: function () { }
      });
    },
// Helper to get all current UI values in a JSON object
_getCurrentVariantData: function () {
    var oView = this.getView();
    return {
        ledger: oView.byId("idLedgerBox").getValue(),
        companyCode: oView.byId("idCompanyCodeBox").getValue(),
        glHier: oView.byId("idGLAccountHierarchy").getValue(),
        dateFrom: oView.byId("idPostingDateFrom").getDateValue(),
        dateTo: oView.byId("idPostingDateTo").getDateValue(),
        // Map tokens to a simple array of objects
        groupAccounts: oView.byId("idGroupAccountNumber").getTokens().map(function (oToken) {
            return {
                key: oToken.getKey(),
                text: oToken.getText(),
                rangeData: oToken.data("range") // Important for BT/Exclude logic
            };
        })
    };
},

// Helper to set UI values from a saved JSON object
_applyVariantData: function (oData) {
    var oView = this.getView();
    oView.byId("idLedgerBox").setValue(oData.ledger);
    oView.byId("idCompanyCodeBox").setValue(oData.companyCode);
    oView.byId("idGLAccountHierarchy").setValue(oData.glHier);
    oView.byId("idPostingDateFrom").setDateValue(oData.dateFrom ? new Date(oData.dateFrom) : null);
    oView.byId("idPostingDateTo").setDateValue(oData.dateTo ? new Date(oData.dateTo) : null);

    var oMultiInput = oView.byId("idGroupAccountNumber");
    oMultiInput.removeAllTokens();
    oData.groupAccounts.forEach(function (item) {
        var oToken = new Token({ key: item.key, text: item.text });
        if (item.rangeData) {
            oToken.data("range", item.rangeData);
        }
        oMultiInput.addToken(oToken);
    });
    
    this.onFilterChange(); 
},
onSaveVariant: function (oEvent) {
    var oVM = oEvent.getSource();
    var sName = oEvent.getParameter("name");
    var sKey = oEvent.getParameter("key"); 
    var bOverwrite = oEvent.getParameter("overwrite");

    
    var oCurrentValues = this._getCurrentVariantData();

    this._mSavedVariants[sKey] = {
        name: sName,
        data: oCurrentValues
    };

  
    oVM.setInitialSelectionKey(sKey);
    
 
    localStorage.setItem("mySyrusVariants", JSON.stringify(this._mSavedVariants));

    sap.m.MessageToast.show("Variant '" + sName + "' saved successfully.");
},

onSelectVariant: function (oEvent) {
    var sKey = oEvent.getParameter("key");
    var oVariant = this._mSavedVariants[sKey];

    if (oVariant && oVariant.data) {
        this._applyVariantData(oVariant.data);
        sap.m.MessageToast.show("Variant '" + oVariant.name + "' applied.");
    } else {
        
        this.onClearFilters();
    }
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
    },

    _getFilters : function (){
      var oView = this.getView();
      var sLedger = oView.byId("idLedgerBox").getValue().toUpperCase();
      var sCompanyCode = oView.byId("idCompanyCodeBox").getValue().toUpperCase();
      var sGLAccountHier = oView.byId("idGLAccountHierarchy").getValue().toUpperCase();
      var dDateFrom = oView.byId("idPostingDateFrom").getDateValue();
      var dDateTo = oView.byId("idPostingDateTo").getDateValue();
      var oDateFormat = DateFormat.getDateInstance({ pattern: "yyyy-MM-dd" });
      var sDateFrom = dDateFrom ? oDateFormat.format(dDateFrom) : null;
      var sDateTo = dDateTo ? oDateFormat.format(dDateTo) : null;
      var sFiscalPeriod = String(dDateFrom.getMonth() + 1).padStart(2, "0");
      var sFiscalYear = dDateTo.getFullYear();
      var aAccountGroup = oView.byId("idGroupAccountNumber").getTokens();
      var aFilters = [
        new Filter("Ledger", FilterOperator.EQ, sLedger),
        new Filter("Companycode", FilterOperator.EQ, sCompanyCode),
        new Filter("Glaccounthier", FilterOperator.EQ, sGLAccountHier),
        new Filter("From_postingdate", FilterOperator.GE, sDateFrom),
        new Filter("To_postingdate", FilterOperator.LE, sDateTo),
        new Filter("FiscalPeriod", FilterOperator.LE, sFiscalPeriod),
        new Filter("FiscalYear", FilterOperator.LE, sFiscalYear),
      ];

      for (var i = 0; i < aAccountGroup.length; i++) {
        var oToken = aAccountGroup[i];
        var oFilterData = oToken.data('range');
        var sCommonOperator = FilterOperator.EQ;
        if (oFilterData){
          
          if (oFilterData.exclude) {
            sCommonOperator = FilterOperator.NE;
          }
          if (oFilterData.operation === "BT") {
            aFilters.push(new Filter("CorpgrpacctBefore", FilterOperator.BT, oFilterData.value1, oFilterData.value2));
          }else if (oFilterData.operation === "Empty") {
            aFilters.push(new Filter("CorpgrpacctBefore", sCommonOperator, ""));
          }
          else {
            if (oFilterData.exclude && oFilterData.operation === FilterOperator.EQ) {
              aFilters.push(new Filter("CorpgrpacctBefore", FilterOperator.NE, oFilterData.value1));
            }else {
              aFilters.push(new Filter("CorpgrpacctBefore", oFilterData.operation, oFilterData.value1));
            }
          }
        }else{
          aFilters.push(new Filter("CorpgrpacctBefore", sCommonOperator, oToken.getKey()));
        }
      }

      return aFilters;
    }

  });
});
