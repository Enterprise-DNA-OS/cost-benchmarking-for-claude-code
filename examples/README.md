# Import fixture

uniphi-budget.csv is a synthetic fixture using the headers described in UniPhi's [budget export guide](https://knowledge.uniphi-software.com/post/8-how-to-create-import-budgets). It is not a captured customer export. The parent total is deliberately present to test that the importer counts leaf elements once. All amounts and projects are fictional.

Export Costs > Budget, open the workbook, then save the Budget worksheet as UTF-8 CSV. Preserve CodeN and DescriptionN headers. Remove currency symbols and thousands separators from numeric cells. Budget is authoritative when both Budget and Qty/Rate are present. Explicit zero is supported. Blank quantities do not become guessed measurements. Use a separate file and explicit plan metadata for each cost plan revision.
