sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/ui/core/BusyIndicator",
    "sap/ui/core/format/DateFormat",
    "sap/ui/comp/valuehelpdialog/ValueHelpDialog",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/type/String",
    "sap/m/ColumnListItem",
    "sap/m/Label",
    "sap/m/SearchField",
    "sap/m/Token",
    "sap/ui/model/odata/v2/ODataModel",
    "sap/ui/table/Column",
    "sap/m/Column",
    "sap/m/Text",
  ],
  function (
    Controller,
    JSONModel,
    MessageBox,
    BusyIndicator,
    DateFormat,
    ValueHelpDialog,
    Filter,
    FilterOperator,
    TypeString,
    ColumnListItem,
    Label,
    SearchField,
    Token,
    ODataModel,
    UIColumn,
    MColumn,
    Text
  ) {
    "use strict";

    let oGATokens;

    return Controller.extend(
      "com.lvmh.apollo.zsyrusdataprepui.controller.Filters",
      {
        /* =========================================================== */
        /* INIT                                                       */
        /* =========================================================== */

        onInit: function () {
          var oModel = new JSONModel({
            applyEnabled: false,
          });
          this.getView().setModel(oModel, "reportModel");

          var oView = this.getView();
          var iYear = new Date().getFullYear();

          oView.byId("idGLAccountHierarchy").setValue("IFRS");
          oView.byId("idPostingDateFrom").setDateValue(new Date(iYear, 0, 1));
          oView
            .byId("idPostingDateTo")
            .setDateValue(new Date(iYear, new Date().getMonth(), 0));

          this.getView()
            .getModel("reportModel")
            .setProperty("/applyEnabled", true);

          oGATokens = this.byId("idGroupAccountNumber");
          this._oGAToken = oGATokens;
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
        /* GROUP ACCOUNT VALUE HELP                                    */
        /* =========================================================== */

        onGroupAccountValueHelp: function () {
          var oView = this.getView();
          var oMultiInput = oView.byId("idGroupAccountNumber");

          // ✅ get the correct named model from manifest
          var oGroupAccountModel = this.getOwnerComponent().getModel(
            "ZDDL_FI_GROUPACCOUNT_CDS"
          );

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
              }.bind(this),
            });

            this._oGroupAccVHD.getTableAsync().then(function (oTable) {
              // ✅ THIS is the critical line
              oTable.setModel(oGroupAccountModel);

              // sap.ui.table.Table requires bindRows
              oTable.bindRows("/ZDDL_FI_GROUPACCOUNT");

              oTable.addColumn(
                new sap.ui.table.Column({
                  label: new sap.m.Label({ text: "Group Account Number" }),
                  template: new sap.m.Text({ text: "{bilkt}" }),
                })
              );
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

          if (
            !sCompanyCode ||
            !sLedger ||
            !sGLHierarchy ||
            !dDateFrom ||
            !dDateTo
          ) {
            MessageBox.error("Please fill in all required fields.");
            return;
          }

          var aTokens = oView.byId("idGroupAccountNumber").getTokens();
          var sGroupAccounts = aTokens
            .map(function (oToken) {
              return oToken.getKey(); // bilkt
            })
            .join(",");

          var oDateFormat = DateFormat.getDateInstance({
            pattern: "yyyy-MM-dd",
          });
          let oPayload = {};

          if (aTokens.length !== 0) {
            let aPayload = [];
            aTokens.forEach((element) => {
              oPayload = {
                Companycode: sCompanyCode,
                Ledger: sLedger,
                Glaccounthier: sGLHierarchy,
                From_postingdate: oDateFormat.format(dDateFrom),
                To_postingdate: oDateFormat.format(dDateTo),
                FiscalPeriod: String(dDateFrom.getMonth() + 1).padStart(2, "0"),
                FiscalYear: String(dDateTo.getFullYear()),
                CorpgrpacctBefore: element.getKey(),
                CorpgracctAfter: "",
              };

              aPayload.push(oPayload);
            });
            this._onDataPrep(aPayload);
          } else {
            oPayload = {
              Companycode: sCompanyCode,
              Ledger: sLedger,
              Glaccounthier: sGLHierarchy,
              From_postingdate: oDateFormat.format(dDateFrom),
              To_postingdate: oDateFormat.format(dDateTo),
              FiscalPeriod: String(dDateFrom.getMonth() + 1).padStart(2, "0"),
              FiscalYear: String(dDateTo.getFullYear()),
              CorpgrpacctBefore: "",
              CorpgracctAfter: "",
            };
            this._onDataPrep(oPayload);
          }

          BusyIndicator.show();
        },

        /* =========================================================== */
        /* ODATA CREATE CALL                                           */
        /* =========================================================== */

        _onDataPrep: function (oPayload) {
          let oModel = this.getView().getModel();
          oModel.setUseBatch(true);
          oModel.create("/SyrusSet", oPayload, {
            success: function (oData, oResponse) {
              BusyIndicator.hide();

              if (oResponse.headers && oResponse.headers["sap-message"]) {
                var oMsg = JSON.parse(oResponse.headers["sap-message"]);

                if (oMsg.severity === "warning") {
                  MessageBox.warning(
                    oMsg.details
                      .map(function (d) {
                        return d.message;
                      })
                      .join("\n")
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
            },
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
        },

        // GRP ACCT VH
        _filterVHTable: function (oFilter, oVHD) {
          oVHD.getTableAsync().then(function (oTable) {
            if (oTable.bindRows) {
              oTable.getBinding("rows").filter(oFilter);
            }
            if (oTable.bindItems) {
              oTable.getBinding("items").filter(oFilter);
            }
            oVHD.update();
          });
        },

        onVHGrpAcctRequested: function () {
          let i18n = this.getOwnerComponent()
            .getModel("i18n")
            .getResourceBundle();
          this._oBasicGASearchField = new SearchField();
          this.loadFragment({
            name: "com.lvmh.apollo.zsyrusdataprepui.view.fragments.GroupAcctVH",
          }).then(
            function (oGADialog) {
              var oFilterBar = oGADialog.getFilterBar(),
                oColumnGrpAcct;
              this._oGAVHD = oGADialog;

              this.getView().addDependent(oGADialog);

              // Set key fields for filtering in the Define Conditions Tab
              oGADialog.setRangeKeyFields([
                {
                  label: i18n.getText("vh.Title"),
                  key: "bilkt",
                  type: "string",
                  typeInstance: new TypeString(
                    {},
                    {
                      maxLength: 10,
                    }
                  ),
                },
              ]);

              // Set Basic Search for FilterBar
              oFilterBar.setFilterBarExpanded(false);
              oFilterBar.setBasicSearch(this._oBasicGASearchField);

              // Trigger filter bar search when the basic search is fired
              this._oBasicGASearchField.attachSearch(function () {
                oFilterBar.search();
              });

              oGADialog.getTableAsync().then(
                function (oTable) {
                  oTable.setModel(
                    this.getOwnerComponent().getModel(
                      "ZDDL_FI_GROUPACCOUNT_CDS"
                    )
                  );

                  // For Desktop and tabled the default table is sap.ui.table.Table
                  if (oTable.bindRows) {
                    // Bind rows to the ODataModel and add columns
                    oTable.bindAggregation("rows", {
                      path: "ZDDL_FI_GROUPACCOUNT_CDS>/ZDDL_FI_GROUPACCOUNT",
                      events: {
                        dataReceived: function () {
                          oGADialog.update();
                        },
                      },
                    });
                    oColumnGrpAcct = new UIColumn({
                      label: new Label({
                        text: i18n.getText("vh.Title"),
                      }),
                      template: new Text({
                        wrapping: false,
                        text: "{ZDDL_FI_GROUPACCOUNT_CDS>bilkt}",
                      }),
                    });
                    oColumnGrpAcct.data({
                      fieldName: "bilkt",
                    });
                    oTable.addColumn(oColumnGrpAcct);
                  }

                  // For Mobile the default table is sap.m.Table
                  if (oTable.bindItems) {
                    // Bind items to the ODataModel and add columns
                    oTable.bindAggregation("items", {
                      path: "ZDDL_FI_GROUPACCOUNT_CDS>/ZDDL_FI_GROUPACCOUNT",
                      template: new ColumnListItem({
                        cells: [new Label({ text: i18n.getText("vh.Title") })],
                      }),
                      events: {
                        dataReceived: function () {
                          oGADialog.update();
                        },
                      },
                    });
                    oTable.addColumn(
                      new MColumn({
                        header: new Label({
                          text: i18n.getText("vh.Title"),
                        }),
                      })
                    );
                  }
                  oGADialog.update();
                }.bind(this)
              );

              oGADialog.setTokens(this._oGAToken.getTokens());
              oGADialog.open();
            }.bind(this)
          );
        },

        onVHGAOkPress: function (oEvent) {
          var aTokens = oEvent.getParameter("tokens");
          this._oGAToken.setTokens(aTokens);
          this._oGAVHD.close();
        },
        onVHGACancelPress: function () {
          this._oGAVHD.close();
        },
        onVHGAAfterClose: function () {
          this._oGAVHD.destroy();
        },
        onGASearch: function (oEvent) {
          var sSearchQuery = this._oBasicGASearchField.getValue(),
            aSelectionSet = oEvent.getParameter("selectionSet"),
            aFilters =
              aSelectionSet &&
              aSelectionSet.reduce(function (aResult, oControl) {
                if (oControl.getValue()) {
                  aResult.push(
                    new Filter({
                      path: oControl.getName(),
                      operator: FilterOperator.Contains,
                      value1: oControl.getValue(),
                    })
                  );
                }

                return aResult;
              }, []);

          aFilters.push(
            new Filter({
              filters: [
                new Filter({
                  path: "bilkt",
                  operator: FilterOperator.Contains,
                  value1: sSearchQuery,
                }),
              ],
              and: false,
            })
          );

          this._filterVHTable(
            new Filter({
              filters: aFilters,
              and: true,
            }),
            this._oGAVHD
          );
        },
      }
    );
  }
);
