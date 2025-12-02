const authQueries = require("./authQueries.cjs");
const candidateQueries = require("./candidateQueries.cjs");
const employerQueries = require("./employerQueries.cjs");
const jobQueries = require("./jobQueries.cjs");
const placementQueries = require("./placementQueries.cjs");
const trackingQueries = require("./trackingQueries.cjs");
const financeQueries = require("./financeQueries.cjs");
const reportsQueries = require("./reportsQueries.cjs");
const recycleQueries = require("./recycleQueries.cjs");
const settingsQueries = require("./settingsQueries.cjs");
const communicationQueries = require("./communicationQueries.cjs");
const systemQueries = require("./systemQueries.cjs");

module.exports = {
    ...authQueries,
    ...candidateQueries,
    ...employerQueries,
    ...jobQueries,
    ...placementQueries,
    ...trackingQueries,
    ...financeQueries,
    ...reportsQueries,
    ...recycleQueries,
    ...settingsQueries,
    ...communicationQueries,
    ...systemQueries
};
