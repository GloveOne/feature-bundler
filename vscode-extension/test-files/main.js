import { helper } from "./utils/helper.js";
import { formatText } from "./utils/formatter.js";

export function main() {
  const result = helper();
  return formatText(result);
  
}
