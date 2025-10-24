// plugins/allow-non-modular.js
const { withXcodeProject } = require("@expo/config-plugins");

module.exports = function withAllowNonModular(config) {
  return withXcodeProject(config, (cfg) => {
    const proj = cfg.modResults;
    const sections = proj.pbxXCBuildConfigurationSection();

    for (const key in sections) {
      const conf = sections[key];
      if (!conf || typeof conf !== "object" || !conf.buildSettings) continue;

      // Tolère les headers non modulaires dans les frameworks (évite -Werror)
      conf.buildSettings.CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES = "YES";

      // Désactive la promotion de cet avertissement en erreur (sécurité)
      const otherCFlags = conf.buildSettings.OTHER_CFLAGS || [];
      const flags = Array.isArray(otherCFlags) ? otherCFlags : [otherCFlags];
      if (!flags.includes("-Wno-error=non-modular-include-in-framework-module")) {
        flags.push("-Wno-error=non-modular-include-in-framework-module");
      }
      conf.buildSettings.OTHER_CFLAGS = flags;
    }
    return cfg;
  });
};