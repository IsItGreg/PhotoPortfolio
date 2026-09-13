// A checked-in build policy, not an ignored machine-local .env setting.
process.env.GENERATE_SOURCEMAP = "false";
require("react-scripts/scripts/build");
