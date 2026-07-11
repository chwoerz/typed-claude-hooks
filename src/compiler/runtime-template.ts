export function generateRuntime(handlerExpression: string): string {
  return `
var __stdin = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", function(chunk) { __stdin += chunk; });
process.stdin.on("end", function() {
  var __input;
  Promise.resolve()
    .then(function() {
      __input = JSON.parse(__stdin);
      return ${handlerExpression}(__input);
    })
    .then(function(result) {
      if (result && result.hookSpecificOutput && !("hookEventName" in result.hookSpecificOutput)) {
        result = {
          ...result,
          hookSpecificOutput: {
            ...result.hookSpecificOutput,
            hookEventName: __input.hook_event_name,
          },
        };
      }
      if (result && Object.keys(result).length > 0) {
        process.stdout.write(JSON.stringify(result));
      }
    })
    .catch(function(err) {
      process.stderr.write(err && err.stack ? err.stack : String(err));
      process.exitCode = 2;
    });
});
`.trimStart();
}
