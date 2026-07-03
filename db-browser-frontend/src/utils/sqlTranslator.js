import { Parser } from 'node-sql-parser';

export const explainSqlToEnglish = (sqlQuery) => {
  if (!sqlQuery || !sqlQuery.trim()) return "No query provided.";

  try {
    const parser = new Parser();
    // Parse the PostgreSQL query into an AST object
    const astArray = parser.astify(sqlQuery, { database: 'PostgreSQL' });
    
    // Some queries return an array of ASTs, grab the first one
    const ast = Array.isArray(astArray) ? astArray[0] : astArray;

    if (ast.type !== 'select') {
      return `This query performs a ${ast.type.toUpperCase()} operation on the database.`;
    }

    let explanation = [];

    // 1. SELECT (What are we getting?)
    if (ast.columns === '*') {
      explanation.push("Fetch all information");
    } else {
      const columnNames = ast.columns.map(col => {
        // Handle basic columns and aliases
        let name = col.expr.column || col.expr.type;
        if (col.as) name += ` (labeled as '${col.as}')`;
        return name;
      });
      explanation.push(`Fetch the ${columnNames.join(', ')}`);
    }

    // 2. FROM (Where is it coming from?)
    if (ast.from && ast.from.length > 0) {
      const tables = ast.from.map(f => f.table).join(' and ');
      explanation.push(`from the '${tables}' records`);
    }

    // 3. JOIN (Are we linking data?)
    if (ast.from && ast.from.length > 1) {
       // Advanced logic can go here to parse ast.from[1].join properties
       explanation.push("by linking multiple data sources together");
    }

    // 4. WHERE (What are the filters?)
    if (ast.where) {
      const parseWhere = (node) => {
        if (!node) return "";
        if (node.type === 'binary_expr') {
          const left = node.left.column || node.left.value;
          const right = node.right.value || node.right.column;
          let operator = node.operator;
          
          // Make operators human friendly
          if (operator === '=') operator = 'is exactly';
          if (operator === '>') operator = 'is greater than';
          if (operator === '<') operator = 'is less than';
          if (operator === 'LIKE') operator = 'contains or matches';

          return `${left} ${operator} ${right}`;
        }
        return "specific filter conditions";
      };

      explanation.push(`but only include records where ${parseWhere(ast.where)}`);
    }

    // 5. ORDER BY (How is it sorted?)
    if (ast.orderby) {
      const sorts = ast.orderby.map(order => {
        const dir = order.type === 'DESC' ? 'highest-to-lowest' : 'lowest-to-highest';
        return `${order.expr.column} (${dir})`;
      });
      explanation.push(`. Finally, sort the results by ${sorts.join(', ')}`);
    }

    // 6. LIMIT (Is there a cap?)
    if (ast.limit && ast.limit.value && ast.limit.value[0]) {
      explanation.push(`and limit the output to ${ast.limit.value[0].value} results max`);
    }

    return explanation.join(' ') + '.';

  } catch (error) {
    // If the parser fails (e.g., complex CTEs, syntax errors), provide a safe fallback
    console.error("SQL parsing failed for explanation:", error);
    return "This is a complex query that retrieves specific data based on advanced logic.";
  }
};