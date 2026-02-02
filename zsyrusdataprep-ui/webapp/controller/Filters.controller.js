sap.ui.define(
  [
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
  ],
  function (
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
    FilterOperator,
  ) {
    "use strict";

    return Controller.extend(
      "com.lvmh.apollo.zsyrusdataprepui.controller.Filters",
      {
        _bApplyingVariant: false,
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

          /* ===============================
         VARIANT RESTORE (ADD THIS)
      =============================== */
          var sUserKey = this._getUserVariantKey();
          this._mSavedVariants = JSON.parse(
            localStorage.getItem(sUserKey) || "{}",
          );

          this._rebuildVariantItems();

          var sLastKey = localStorage.getItem(sUserKey + "_last");
          if (sLastKey && this._mSavedVariants[sLastKey]) {
            this.byId("idVariantManagement").setInitialSelectionKey(sLastKey);
            this._applyVariantData(this._mSavedVariants[sLastKey].data);
          } else {
            this._applyStandard();
          }
        },

        /* =========================================================== */
        /* FILTER CHANGE                                               */
        /* =========================================================== */
        onFilterChange: function () {
          if (this._bApplyingVariant) {
            return;
          }

          var oView = this.getView();

          var bEnable = !!(
            oView.byId("idCompanyCodeBox").getValue() &&
            oView.byId("idLedgerBox").getValue() &&
            oView.byId("idGLAccountHierarchy").getValue() &&
            oView.byId("idPostingDateFrom").getDateValue() &&
            oView.byId("idPostingDateTo").getDateValue()
          );

          oView.getModel("reportModel").setProperty("/applyEnabled", bEnable);

          this.byId("idVariantManagement").currentVariantSetModified(true);
        },

        onCompanyCodeChange: function (oEvent) {
          const oComboBox = oEvent.getSource();
          const sValue = oComboBox.getValue();
          const aItems = oComboBox.getItems();
          const oButton = this.byId("ApplyButton");

          let bValid = false;

          aItems.forEach(function (oItem) {
            if (oItem.getText() === sValue) {
              bValid = true;
            }
          });

          oButton.setEnabled(bValid);

          oComboBox.setValueState(bValid ? "None" : "Error");
          oComboBox.setValueStateText(
            bValid ? "" : "Please select a valid Company Code",
          );
        },
        /* =========================================================== */
        /* GROUP ACCOUNT VALUE HELP                                    */
        /* =========================================================== */
        onGroupAccountValueHelp: function () {
          var oView = this.getView();
          var oMultiInput = oView.byId("idGroupAccountNumber");
          var oGroupAccountModel = this.getOwnerComponent().getModel(
            "ZDDL_FI_GROUPACCOUNT_CDS",
          );

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
                  aFilters.push(
                    new sap.ui.model.Filter(
                      "bilkt",
                      sap.ui.model.FilterOperator.Contains,
                      sValue,
                    ),
                  );
                }
                oBinding.filter(aFilters);
                this._updateGroupAccountCount();
              }.bind(this),
            });

            // FILTER BAR
            var oFilterBar = new FilterBar({
              advancedMode: false,
              filterBarExpanded: false,
              showGoOnFB: false,
              useToolbar: true,
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
                  type: "string",
                },
              ],
              filterBar: oFilterBar,
              ok: function (oEvent) {
                oMultiInput.setTokens(oEvent.getParameter("tokens"));

                if (!this._bApplyingVariant) {
                  this.byId("idVariantManagement").currentVariantSetModified(
                    true,
                  );
                }

                this._oGroupAccVHD.close();
              }.bind(this),

              cancel: function () {
                this.close();
              },
              afterClose: function () {
                this.destroy();
                this._oGroupAccVHD = null;
              }.bind(this),
            });

            this._oGroupAccVHD.setRangeKeyFields([
              {
                label: "Group Account Number",
                key: "bilkt",
                type: "string",
              },
            ]);

            this._oGroupAccVHD.getTableAsync().then(
              function (oTable) {
                oTable.setModel(oGroupAccountModel);
                oTable.bindRows("/ZDDL_FI_GROUPACCOUNT");
                oTable.addColumn(
                  new sap.ui.table.Column({
                    label: new sap.m.Label({ text: "Group Account Number" }),
                    template: new sap.m.Text({ text: "{bilkt}" }),
                  }),
                );
                oTable.getBinding("rows").attachDataReceived(
                  function () {
                    this._updateGroupAccountCount();
                  }.bind(this),
                );
              }.bind(this),
            );
          }

          this._oGroupAccVHD.open();
          setTimeout(
            function () {
              this._updateGroupAccountCount();
            }.bind(this),
            0,
          );
        },
        _getUserVariantKey: function () {
          var oUserInfo = sap.ushell?.Container?.getService("UserInfo");
          var sUserId = oUserInfo ? oUserInfo.getId() : "ANONYMOUS";
          return "SYRUS_VARIANTS_" + sUserId;
        },

        _updateGroupAccountCount: function () {
          if (!this._oGroupAccVHD) return;
          var oTable = this._oGroupAccVHD.getTable();
          var oBinding = oTable && oTable.getBinding("rows");
          if (!oBinding) return;
          this._oGroupAccVHD.setTitle(
            "Group Account (" + oBinding.getLength() + ")",
          );
        },

        /* =========================================================== */
        /* BUILD FILTER STRING FOR GET                                 */
        /* =========================================================== */
        _buildFilterString: function () {
          var oView = this.getView();
          var dDateFrom = oView.byId("idPostingDateFrom").getDateValue();
          var dDateTo = oView.byId("idPostingDateTo").getDateValue();
          var oDateFormat = DateFormat.getDateInstance({
            pattern: "yyyy-MM-dd",
          });
          var sDateFrom = dDateFrom ? oDateFormat.format(dDateFrom) : null;
          var sDateTo = dDateTo ? oDateFormat.format(dDateTo) : null;

          var sFilter =
            "Companycode eq '" +
            oView.byId("idCompanyCodeBox").getValue() +
            "'" +
            " and Ledger eq '" +
            oView.byId("idLedgerBox").getValue() +
            "'" +
            " and Glaccounthier eq '" +
            oView.byId("idGLAccountHierarchy").getValue() +
            "'";

          if (sDateFrom) {
            sFilter += " and From_postingdate ge '" + sDateFrom + "'";
            sFilter +=
              " and FiscalPeriod eq '" +
              String(dDateFrom.getMonth() + 1).padStart(2, "0") +
              "'";
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
                    "(CorpgrpacctBefore ge '" +
                      oRange.value1 +
                      "' and CorpgrpacctBefore le '" +
                      oRange.value2 +
                      "')",
                  );
                }

                if (oRange.operation === "EQ") {
                  aConditions.push(
                    "CorpgrpacctBefore eq '" + oRange.value1 + "'",
                  );
                }
              } else {
                aConditions.push(
                  "CorpgrpacctBefore eq '" + oToken.getKey() + "'",
                );
              }
            });

            sFilter += " and (" + aConditions.join(" or ") + ")";
          }

          return sFilter;
        },

        /* =========================================================== */
        /* APPLY FILTERS                                               */
        /* =========================================================== */
        onApplyFilters: function (oEvent) {
          var oModel = this.getView().getModel();
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
              var sSapMessage =
                oResponse &&
                oResponse.headers &&
                oResponse.headers["sap-message"];

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
                      MessageBox.warning(sMessage + "\n\n" + sBackendMsg);
                      break;

                    case "success":
                      MessageBox.success(
                        sSuccessMessage + "\n\n" + sBackendMsg,
                      );
                      break;

                    default:
                      MessageBox.information(
                        sSuccessMessage + "\n\n" + sBackendMsg,
                      );
                  }
                } catch (e) {
                  MessageBox.success(sSuccessMessage);
                }
              } else {
                MessageBox.success(sSuccessMessage);
              }
            },
            error: function (oError) {
              BusyIndicator.hide();
              MessageBox.error(
                oError.responseText
                  ? JSON.parse(oError.responseText).error.message.value
                  : "Unknown error",
              );
            },
            complete: function () {},
          });
        },

        _getCurrentVariantData: function () {
          var oView = this.getView();
          return {
            ledger: oView.byId("idLedgerBox").getValue(),
            companyCode: oView.byId("idCompanyCodeBox").getValue(),
            glHier: oView.byId("idGLAccountHierarchy").getValue(),
            dateFrom: oView.byId("idPostingDateFrom").getDateValue(),
            dateTo: oView.byId("idPostingDateTo").getDateValue(),

            groupAccounts: oView
              .byId("idGroupAccountNumber")
              .getTokens()
              .map(function (oToken) {
                return {
                  key: oToken.getKey(),
                  text: oToken.getText(),
                  rangeData: oToken.data("range"),
                };
              }),
          };
        },

        _applyVariantData: function (oData) {
          var oView = this.getView();
          var oVM = this.byId("idVariantManagement");

          this._bApplyingVariant = true;

          oView.byId("idLedgerBox").setValue(oData.ledger);
          var sCompanyCode = oData.companyCode;

          // DROP EXTRA VALUES IF ARRAY
          if (Array.isArray(sCompanyCode)) {
            sCompanyCode = sCompanyCode[0] || "";
          }

          oView.byId("idCompanyCodeBox").setValue(sCompanyCode);

          oView.byId("idGLAccountHierarchy").setValue(oData.glHier);

          oView
            .byId("idPostingDateFrom")
            .setDateValue(oData.dateFrom ? new Date(oData.dateFrom) : null);

          oView
            .byId("idPostingDateTo")
            .setDateValue(oData.dateTo ? new Date(oData.dateTo) : null);

          var oMultiInput = oView.byId("idGroupAccountNumber");
          oMultiInput.removeAllTokens();

          oData.groupAccounts.forEach(function (item) {
            var oToken = new Token({ key: item.key, text: item.text });
            if (item.rangeData) {
              oToken.data("range", item.rangeData);
            }
            oMultiInput.addToken(oToken);
          });

          this._bApplyingVariant = false;

          oVM.currentVariantSetModified(false);
        },

        onSaveVariant: function (oEvent) {
          var sKey = oEvent.getParameter("key");
          var sName = oEvent.getParameter("name");
          var bOverwrite = oEvent.getParameter("overwrite");

          this._mSavedVariants[sKey] = {
            name: sName,
            data: this._getCurrentVariantData(),
          };

          var sUserKey = this._getUserVariantKey();
          localStorage.setItem(sUserKey, JSON.stringify(this._mSavedVariants));
          localStorage.setItem(sUserKey + "_last", sKey);

          var oVM = this.byId("idVariantManagement");

          if (!bOverwrite) {
            oVM.addVariantItem(
              new sap.ui.comp.variants.VariantItem({
                key: sKey,
                text: sName,
              }),
            );
          }

          oVM.setInitialSelectionKey(sKey);
          sap.m.MessageToast.show(
            bOverwrite ? "Variant updated" : "Variant saved",
          );
          this.byId("idVariantManagement").currentVariantSetModified(false);
        },

        onSelectVariant: function (oEvent) {
          var sKey = oEvent.getParameter("key");

          if (sKey === "*" || !this._mSavedVariants[sKey]) {
            this._applyStandard();
            return;
          }

          this._applyVariantData(this._mSavedVariants[sKey].data);
          localStorage.setItem(this._getUserVariantKey() + "_last", sKey);
        },

        _applyStandard: function () {
          var oView = this.getView();
          var oVM = this.byId("idVariantManagement");
          var iYear = new Date().getFullYear();

          this._bApplyingVariant = true;

          oView.byId("idLedgerBox").setValue("GG");
          oView.byId("idCompanyCodeBox").setValue("LVMH");
          oView.byId("idGLAccountHierarchy").setValue("IFRS");
          oView.byId("idPostingDateFrom").setDateValue(new Date(iYear, 0, 1));
          oView.byId("idPostingDateTo").setDateValue(new Date(iYear, 11, 31));
          oView.byId("idGroupAccountNumber").removeAllTokens();

          this._bApplyingVariant = false;

          oVM.currentVariantSetModified(false);
        },

        onGroupAccountTokenUpdate: function (oEvent) {
  if (this._bApplyingVariant) {
    return;
  }

  var oMultiInput = this.byId("idGroupAccountNumber");
  var aTokens = oMultiInput.getTokens();

  aTokens.forEach(function (oToken) {
   
    if (oToken.getKey()) {
      oToken.setKey(oToken.getKey().toUpperCase());
    }
    if (oToken.getText()) {
      oToken.setText(oToken.getText().toUpperCase());
    }

    // Uppercase range values (EQ / BT)
    var oRange = oToken.data("range");
    if (oRange) {
      if (oRange.value1) {
        oRange.value1 = oRange.value1.toUpperCase();
      }
      if (oRange.value2) {
        oRange.value2 = oRange.value2.toUpperCase();
      }
      oToken.data("range", oRange);
    }
  });

  this.byId("idVariantManagement").currentVariantSetModified(true);
  this.onFilterChange();
}
,

        onManageVariants: function (oEvent) {
          var aDeleted = oEvent.getParameter("deleted") || [];
          var aRenamed = oEvent.getParameter("renamed") || [];
          var aOverwritten = oEvent.getParameter("overwritten") || [];

          // DELETE
          aDeleted.forEach(
            function (sKey) {
              delete this._mSavedVariants[sKey];
            }.bind(this),
          );

          // RENAME
          aRenamed.forEach(
            function (oRename) {
              if (this._mSavedVariants[oRename.key]) {
                this._mSavedVariants[oRename.key].name = oRename.name;
              }
            }.bind(this),
          );

          // OVERWRITE
          aOverwritten.forEach(
            function (sKey) {
              if (this._mSavedVariants[sKey]) {
                this._mSavedVariants[sKey].data = this._getCurrentVariantData();
              }
            }.bind(this),
          );

          // Persist
          localStorage.setItem(
            this._getUserVariantKey(),
            JSON.stringify(this._mSavedVariants),
          );

          // Rebuild UI
          this._rebuildVariantItems();
        },

        _rebuildVariantItems: function () {
          var oVM = this.byId("idVariantManagement");
          oVM.removeAllVariantItems();

          Object.keys(this._mSavedVariants).forEach(
            function (sKey) {
              oVM.addVariantItem(
                new sap.ui.comp.variants.VariantItem({
                  key: sKey,
                  text: this._mSavedVariants[sKey].name,
                }),
              );
            }.bind(this),
          );

          oVM.setInitialSelectionKey("*");
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

        _getFilters: function () {
          var oView = this.getView();
          var sLedger = oView.byId("idLedgerBox").getValue().toUpperCase();
          var sCompanyCode = oView
            .byId("idCompanyCodeBox")
            .getValue()
            .toUpperCase();
          var sGLAccountHier = oView
            .byId("idGLAccountHierarchy")
            .getValue()
            .toUpperCase();
          var dDateFrom = oView.byId("idPostingDateFrom").getDateValue();
          var dDateTo = oView.byId("idPostingDateTo").getDateValue();
          var oDateFormat = DateFormat.getDateInstance({
            pattern: "yyyy-MM-dd",
          });
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
            var oFilterData = oToken.data("range");
            var sCommonOperator = FilterOperator.EQ;
            if (oFilterData) {
              if (oFilterData.exclude) {
                sCommonOperator = FilterOperator.NE;
              }
              if (oFilterData.operation === "BT") {
                aFilters.push(
                  new Filter(
                    "CorpgrpacctBefore",
                    FilterOperator.BT,
                    oFilterData.value1.toUpperCase,
                    oFilterData.value2.toUpperCase,
                  ),
                );
              } else if (oFilterData.operation === "Empty") {
                aFilters.push(
                  new Filter("CorpgrpacctBefore", sCommonOperator, ""),
                );
              } else {
                if (
                  oFilterData.exclude &&
                  oFilterData.operation === FilterOperator.EQ
                ) {
                  aFilters.push(
                    new Filter(
                      "CorpgrpacctBefore",
                      FilterOperator.NE,
                      oFilterData.value1.toUpperCase,
                    ),
                  );
                } else {
                  aFilters.push(
                    new Filter(
                      "CorpgrpacctBefore",
                      oFilterData.operation,
                      oFilterData.value1.toUpperCase,
                    ),
                  );
                }
              }
            } else {
              aFilters.push(
                new Filter(
                  "CorpgrpacctBefore",
                  sCommonOperator,
                  oToken.getKey().toUpperCase(),
                ),
              );
            }
          }

          return aFilters;
        },
      },
    );
  },
);
