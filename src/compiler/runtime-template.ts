export function generateRuntime(handlerExpression: string): string {
  return `
var __stdin = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", function(chunk) { __stdin += chunk; });
process.stdin.on("end", function() {
  Promise.resolve()
    .then(function() { return ${handlerExpression}(JSON.parse(__stdin)); })
    .then(function(result) {
      if (result && Object.keys(result).length > 0) {
        process.stdout.write(JSON.stringify(result));
      }
      process.exit(0);
    })
    .catch(function(err) {
      process.stderr.write(err && err.stack ? err.stack : String(err));
      process.exit(2);
    });
});
`.trimStart();
}
