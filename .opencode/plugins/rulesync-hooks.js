export const RulesyncHooksPlugin = async ({ $ }) => {
  return {
    "tool.execute.before": async (input) => {
      {
        const __re = new RegExp("Write|Edit|NotebookEdit");
        if (__re.test(input.tool)) {
          await $`python3 .harness/hooks/delegation-watch.py`;
        }
      }
    },
    "tool.execute.after": async (input) => {
      {
        const __re = new RegExp("Skill");
        if (__re.test(input.tool)) {
          await $`python3 .harness/hooks/log-skill-usage.py`;
        }
      }
    },
  };
};
