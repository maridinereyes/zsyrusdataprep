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
    FilterOperator
  ) {
    "use strict";

    return Controller.extend("com.lvmh.apollo.zsyrusdataprepui.controller.Filters", {
      _bApplyingVariant: false,

      /* =========================================================== */
      /* INIT                                                        */
      /* =========================================================== */
      onInit: function () {
        this._oBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
        this.getView().setModel(new JSONModel({ applyEnabled: false }), "reportModel");

        const iYear = new Date().getFullYear();

        this.byId("idGLAccountHierarchy").setValue("IFRS");
        this.byId("idPostingDateFrom").setDateValue(new Date(iYear, 0, 1));
        this.byId("idPostingDateTo").setDateValue(new Date(iYear, 11, 31));

        this.getView().getModel("reportModel").setProperty("/applyEnabled", true);

        // Variant Restore
        const sUserKey = this._getUserVariantKey();
        this._mSavedVariants = JSON.parse(localStorage.getItem(sUserKey) || "{}");

        this._rebuildVariantItems();

        const sLastKey = localStorage.getItem(`${sUserKey}_last`);
        if (sLastKey && this._mSavedVariants[sLastKey]) {
          this.byId("idVariantManagement").setInitialSelectionKey(sLastKey);
          this._applyVariantData(this._mSavedVariants[sLastKey].data);
        } else {
          this._applyStandard();
        }
      },

      /* =========================================================== */
      /* EVENT HANDLERS                                              */
      /* =========================================================== */
      onFilterChange: function () {
        if (this._bApplyingVariant) return;

        if (!this._validatePostingDates()) return;

        const bEnable = !!(
          this.byId("idCompanyCodeBox").getValue() &&
          this.byId("idLedgerBox").getValue() &&
          this.byId("idGLAccountHierarchy").getValue() &&
          this.byId("idPostingDateFrom").getDateValue() &&
          this.byId("idPostingDateTo").getDateValue()
        );

        this.getView().getModel("reportModel").setProperty("/applyEnabled", bEnable);
        this.byId("ApplyButton").setEnabled(bEnable);
        this.byId("idVariantManagement").currentVariantSetModified(true);
      },

      onCompanyCodeChange: function (oEvent) {
        const oComboBox = oEvent.getSource();
        const sValue = oComboBox.getValue();
        
        // Use .some() to short-circuit the loop once a match is found
        const bValid = oComboBox.getItems().some((oItem) => oItem.getText() === sValue);

        this.byId("ApplyButton").setEnabled(bValid);
        oComboBox.setValueState(bValid ? "None" : "Error");
        oComboBox.setValueStateText(bValid ? "" : this._oBundle.getText("companyCodeInvalid"));
      },

      /* =========================================================== */
      /* GROUP ACCOUNT VALUE HELP                                    */
      /* =========================================================== */
      onGroupAccountValueHelp: function () {
        const oMultiInput = this.byId("idGroupAccountNumber");
        const oGroupAccountModel = this.getOwnerComponent().getModel("ZDDL_FI_GROUPACCOUNT_CDS");

        if (!oGroupAccountModel) {
          MessageBox.error(this._oBundle.getText("groupAccountModelNotFound"));
          return;
        }

        if (!this._oGroupAccVHD) {
          this._createGroupAccountValueHelp(oMultiInput, oGroupAccountModel);
        }

        this._oGroupAccVHD.open();
        setTimeout(() => this._updateGroupAccountCount(), 0);
      },

      _createGroupAccountValueHelp: function (oMultiInput, oGroupAccountModel) {
        const oSearchField = new SearchField({
          width: "100%",
          liveChange: (oEvent) => {
            const sValue = oEvent.getSource().getValue();
            const oBinding = this._oGroupAccVHD.getTable().getBinding("rows");
            const aFilters = sValue ? [new Filter("bilkt", FilterOperator.Contains, sValue)] : [];
            oBinding.filter(aFilters);
            this._updateGroupAccountCount();
          },
        });

        const oFilterBar = new FilterBar({
          advancedMode: false,
          filterBarExpanded: false,
          showGoOnFB: false,
          useToolbar: true,
        });
        oFilterBar.setBasicSearch(oSearchField);

        this._oGroupAccVHD = new ValueHelpDialog({
          title: this._oBundle.getText("groupAccountTitle"),
          supportMultiselect: true,
          supportRanges: true,
          key: "bilkt",
          descriptionKey: "bilkt",
          rangeKeyFields: [{ label: this._oBundle.getText("groupAccountNumber"), key: "bilkt", type: "string" }],
          filterBar: oFilterBar,
          ok: (oEvent) => {
            const aTokens = oEvent.getParameter("tokens");
            this._formatTokensToUpperCase(aTokens);
            oMultiInput.setTokens(aTokens);

            if (!this._bApplyingVariant) {
              this.byId("idVariantManagement").currentVariantSetModified(true);
            }
            this._oGroupAccVHD.close();
          },
          cancel: function () { this.close(); },
          afterClose: () => {
            this._oGroupAccVHD.destroy();
            this._oGroupAccVHD = null;
          },
        });

        this._oGroupAccVHD.getTableAsync().then((oTable) => {
          oTable.setModel(oGroupAccountModel);
          oTable.bindRows("/ZDDL_FI_GROUPACCOUNT");
          oTable.addColumn(
            new sap.ui.table.Column({
              label: new sap.m.Label({ text: this._oBundle.getText("groupAccountNumber") }),
              template: new sap.m.Text({ text: "{bilkt}" }),
            })
          );
          oTable.getBinding("rows").attachDataReceived(() => this._updateGroupAccountCount());
        });
      },

      _updateGroupAccountCount: function () {
        if (!this._oGroupAccVHD) return;
        const oBinding = this._oGroupAccVHD.getTable()?.getBinding("rows");
        if (oBinding) {
          this._oGroupAccVHD.setTitle(`Group Account (${oBinding.getLength()})`);
        }
      },

      onGroupAccountTokenUpdate: function () {
        if (this._bApplyingVariant) return;

        const aTokens = this.byId("idGroupAccountNumber").getTokens();
        this._formatTokensToUpperCase(aTokens);

        this.byId("idVariantManagement").currentVariantSetModified(true);
        this.onFilterChange();
      },

      _formatTokensToUpperCase: function (aTokens) {
        aTokens.forEach((oToken) => {
          if (oToken.getKey()) oToken.setKey(oToken.getKey().toUpperCase());
          if (oToken.getText()) oToken.setText(oToken.getText().toUpperCase());

          const oRange = oToken.data("range");
          if (oRange) {
            if (oRange.value1) oRange.value1 = oRange.value1.toUpperCase();
            if (oRange.value2) oRange.value2 = oRange.value2.toUpperCase();
            oToken.data("range", oRange);
          }
        });
      },

      /* =========================================================== */
      /* APPLY & DATA RETRIEVAL                                      */
      /* =========================================================== */
      onApplyFilters: function () {
        const aFilters = this._getFilters();
        const sMessage = this._oBundle.getText("successMsginwarning");
        const sSuccessMessage = this._oBundle.getText("successMsgwithoutwarning");

        BusyIndicator.show(0);

        this.getView().getModel().read("/SyrusSet", {
          filters: aFilters,
          success: (oData, oResponse) => {
            BusyIndicator.hide();
            this._handleODataResponseMessages(oResponse, sSuccessMessage, sMessage);
          },
          error: (oError) => {
            BusyIndicator.hide();
            const sErrorMsg = oError.responseText
              ? JSON.parse(oError.responseText).error.message.value
              : "Unknown error";
            MessageBox.error(sErrorMsg);
          },
        });
      },

      _handleODataResponseMessages: function (oResponse, sSuccessMessage, sWarningMessage) {
        const sSapMessage = oResponse?.headers?.["sap-message"];

        if (!sSapMessage) {
          MessageBox.success(sSuccessMessage);
          return;
        }

        try {
          const oMsg = JSON.parse(sSapMessage);
          const sBackendMsg = (oMsg.details && oMsg.details.length > 0)
            ? oMsg.details.map((d) => d.message).join("\n")
            : (oMsg.message || "");

          switch (oMsg.severity) {
            case "error":
              MessageBox.error(sBackendMsg);
              break;
            case "warning":
              const sFormattedMsg = sBackendMsg
                ? sBackendMsg.replace(/(\n)?(Unbalanced balance sheet|Bilan déséquilibré)/g, "\n\n$2\n")
                : "";
              MessageBox.warning([sWarningMessage, sFormattedMsg, oMsg.message || ""].filter(Boolean).join("\n\n"));
              break;
            case "success":
              MessageBox.success(`${sSuccessMessage}\n\n${sBackendMsg}`);
              break;
            default:
              MessageBox.information(`${sSuccessMessage}\n\n${sBackendMsg}`);
          }
        } catch (e) {
          MessageBox.success(sSuccessMessage);
        }
      },

      _getFilters: function () {
        const sLedger = this.byId("idLedgerBox").getValue().toUpperCase();
        const sCompanyCode = this.byId("idCompanyCodeBox").getValue().toUpperCase();
        const sGLAccountHier = this.byId("idGLAccountHierarchy").getValue().toUpperCase();
        
        const dDateFrom = this.byId("idPostingDateFrom").getDateValue();
        const dDateTo = this.byId("idPostingDateTo").getDateValue();
        
        const oDateFormat = DateFormat.getDateInstance({ pattern: "yyyy-MM-dd" });
        const sDateFrom = dDateFrom ? oDateFormat.format(dDateFrom) : null;
        const sDateTo = dDateTo ? oDateFormat.format(dDateTo) : null;
        
        const sFiscalPeriod = String(dDateFrom.getMonth() + 1).padStart(2, "0");
        const sFiscalYear = dDateTo.getFullYear();

        const aFilters = [
          new Filter("Ledger", FilterOperator.EQ, sLedger),
          new Filter("Companycode", FilterOperator.EQ, sCompanyCode),
          new Filter("Glaccounthier", FilterOperator.EQ, sGLAccountHier),
          new Filter("From_postingdate", FilterOperator.GE, sDateFrom),
          new Filter("To_postingdate", FilterOperator.LE, sDateTo),
          new Filter("FiscalPeriod", FilterOperator.LE, sFiscalPeriod),
          new Filter("FiscalYear", FilterOperator.LE, sFiscalYear),
        ];

        const aAccountGroupTokens = this.byId("idGroupAccountNumber").getTokens();

        aAccountGroupTokens.forEach((oToken) => {
          const oFilterData = oToken.data("range");
          const sUpperKey = oToken.getKey().toUpperCase();

          if (!oFilterData) {
            aFilters.push(new Filter("CorpgrpacctBefore", FilterOperator.EQ, sUpperKey));
            return;
          }

          const sOperator = oFilterData.exclude ? FilterOperator.NE : FilterOperator.EQ;

          if (oFilterData.operation === "BT") {
            aFilters.push(new Filter("CorpgrpacctBefore", FilterOperator.BT, oFilterData.value1.toUpperCase(), oFilterData.value2.toUpperCase()));
          } else if (oFilterData.operation === "Empty") {
            aFilters.push(new Filter("CorpgrpacctBefore", sOperator, ""));
          } else {
            const finalOperator = (oFilterData.exclude && oFilterData.operation === FilterOperator.EQ) 
              ? FilterOperator.NE 
              : oFilterData.operation;
            
            aFilters.push(new Filter("CorpgrpacctBefore", finalOperator, oFilterData.value1.toUpperCase()));
          }
        });

        return aFilters;
      },

      /* =========================================================== */
      /* VARIANT MANAGEMENT & VALIDATION                             */
      /* =========================================================== */
      _validatePostingDates: function () {
        const oDateFromPicker = this.byId("idPostingDateFrom");
        const oDateToPicker = this.byId("idPostingDateTo");
        const oApplyButton = this.byId("ApplyButton");

        const dFrom = oDateFromPicker.getDateValue();
        const dTo = oDateToPicker.getDateValue();

        oDateFromPicker.setValueState("None");
        oDateToPicker.setValueState("None");

        if (dFrom && dTo && dFrom > dTo) {
          oDateFromPicker.setValueState("Error").setValueStateText(this._oBundle.getText("dateFromError"));
          oDateToPicker.setValueState("Error").setValueStateText(this._oBundle.getText("dateToError"));
          oApplyButton.setEnabled(false);
          return false;
        }

        return true;
      },

      _getUserVariantKey: function () {
        const oUserInfo = sap.ushell?.Container?.getService("UserInfo");
        return `SYRUS_VARIANTS_${oUserInfo ? oUserInfo.getId() : "ANONYMOUS"}`;
      },

      _getCurrentVariantData: function () {
        return {
          ledger: this.byId("idLedgerBox").getValue(),
          companyCode: this.byId("idCompanyCodeBox").getValue(),
          glHier: this.byId("idGLAccountHierarchy").getValue(),
          dateFrom: this.byId("idPostingDateFrom").getDateValue(),
          dateTo: this.byId("idPostingDateTo").getDateValue(),
          groupAccounts: this.byId("idGroupAccountNumber").getTokens().map((oToken) => ({
            key: oToken.getKey(),
            text: oToken.getText(),
            rangeData: oToken.data("range"),
          })),
        };
      },

      _applyVariantData: function (oData) {
        this._bApplyingVariant = true;

        this.byId("idLedgerBox").setValue(oData.ledger);
        this.byId("idCompanyCodeBox").setValue(Array.isArray(oData.companyCode) ? oData.companyCode[0] || "" : oData.companyCode);
        this.byId("idGLAccountHierarchy").setValue(oData.glHier);
        this.byId("idPostingDateFrom").setDateValue(oData.dateFrom ? new Date(oData.dateFrom) : null);
        this.byId("idPostingDateTo").setDateValue(oData.dateTo ? new Date(oData.dateTo) : null);

        const oMultiInput = this.byId("idGroupAccountNumber");
        oMultiInput.removeAllTokens();

        oData.groupAccounts.forEach((item) => {
          const oToken = new Token({ key: item.key, text: item.text });
          if (item.rangeData) oToken.data("range", item.rangeData);
          oMultiInput.addToken(oToken);
        });

        this._bApplyingVariant = false;
        this.byId("idVariantManagement").currentVariantSetModified(false);
      },

      onSaveVariant: function (oEvent) {
        const sKey = oEvent.getParameter("key");
        const sName = oEvent.getParameter("name");
        const bOverwrite = oEvent.getParameter("overwrite");
        const sUserKey = this._getUserVariantKey();

        this._mSavedVariants[sKey] = { name: sName, data: this._getCurrentVariantData() };

        localStorage.setItem(sUserKey, JSON.stringify(this._mSavedVariants));
        localStorage.setItem(`${sUserKey}_last`, sKey);

        const oVM = this.byId("idVariantManagement");
        if (!bOverwrite) {
          oVM.addVariantItem(new sap.ui.comp.variants.VariantItem({ key: sKey, text: sName }));
        }

        oVM.setInitialSelectionKey(sKey);
        sap.m.MessageToast.show(this._oBundle.getText(bOverwrite ? "variantUpdated" : "variantSaved"));
        oVM.currentVariantSetModified(false);
      },

      onSelectVariant: function (oEvent) {
        const sKey = oEvent.getParameter("key");
        if (sKey === "*" || !this._mSavedVariants[sKey]) {
          this._applyStandard();
          return;
        }
        this._applyVariantData(this._mSavedVariants[sKey].data);
        localStorage.setItem(`${this._getUserVariantKey()}_last`, sKey);
      },

      onManageVariants: function (oEvent) {
        const aDeleted = oEvent.getParameter("deleted") || [];
        const aRenamed = oEvent.getParameter("renamed") || [];
        const aOverwritten = oEvent.getParameter("overwritten") || [];

        aDeleted.forEach((sKey) => delete this._mSavedVariants[sKey]);
        aRenamed.forEach((oRename) => { if (this._mSavedVariants[oRename.key]) this._mSavedVariants[oRename.key].name = oRename.name; });
        aOverwritten.forEach((sKey) => { if (this._mSavedVariants[sKey]) this._mSavedVariants[sKey].data = this._getCurrentVariantData(); });

        localStorage.setItem(this._getUserVariantKey(), JSON.stringify(this._mSavedVariants));
        this._rebuildVariantItems();
      },

      _rebuildVariantItems: function () {
        const oVM = this.byId("idVariantManagement");
        oVM.removeAllVariantItems();

        Object.keys(this._mSavedVariants).forEach((sKey) => {
          oVM.addVariantItem(new sap.ui.comp.variants.VariantItem({ key: sKey, text: this._mSavedVariants[sKey].name }));
        });
        oVM.setInitialSelectionKey("*");
      },

      _applyStandard: function () {
        this._bApplyingVariant = true;
        const iYear = new Date().getFullYear();

        this.byId("idLedgerBox").setValue("GG");
        this.byId("idCompanyCodeBox").setValue("LVMH");
        this.byId("idGLAccountHierarchy").setValue("IFRS");
        this.byId("idPostingDateFrom").setDateValue(new Date(iYear, 0, 1));
        this.byId("idPostingDateTo").setDateValue(new Date(iYear, 11, 31));
        this.byId("idGroupAccountNumber").removeAllTokens();

        this._bApplyingVariant = false;
        this.byId("idVariantManagement").currentVariantSetModified(false);
      },

      onClearFilters: function () {
        this.byId("idLedgerBox").setValue("GG");
        this.byId("idCompanyCodeBox").setValue("LVMH");
        this.byId("idGLAccountHierarchy").setValue("");
        this.byId("idGroupAccountNumber").removeAllTokens();
        this.byId("idPostingDateFrom").setDateValue(null);
        this.byId("idPostingDateTo").setDateValue(null);
        this.getView().getModel("reportModel").setProperty("/applyEnabled", false);
      }
    });
  }
);