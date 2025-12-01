/*global QUnit*/

sap.ui.define([
	"com/lvmh/apollo/zsyrusdataprepui/controller/Filters.controller"
], function (Controller) {
	"use strict";

	QUnit.module("Filters Controller");

	QUnit.test("I should test the Filters controller", function (assert) {
		var oAppController = new Controller();
		oAppController.onInit();
		assert.ok(oAppController);
	});

});
