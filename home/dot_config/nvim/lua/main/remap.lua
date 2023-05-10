local function map(mode, lhs, rhs, opts)
	opts = opts or {}
	opts.silent = opts.silent == nil and true or opts.silent
	vim.keymap.set(mode, lhs, rhs, opts)
end

vim.g.mapleader = " "

map({"n", "v"}, "<leader>fm", [[:Ex<cr>]], {desc = "Go to file manager"})

map({ "n", "v" }, "<leader>y", [["*y]], { desc = "Copy to clipboard" })
map({ "n", "v" }, "<leader>p", [["*p]], { desc = "Paste from clipboard" })
map({ "n", "v" }, "<leader>a", [[ggVG]], { desc = "Select whole file" })

map("n", "<esc>", ":noh<cr>", { desc = "Clear search highlights" })

map("v", "<", "<gv", { desc = "Indent, keeping selection" })
map("v", ">", ">gv", { desc = "Dedent, keeping selection" })

map({ "n", "v" }, "j", "gj", { desc = "Move down through wrapped lines" })
map({ "n", "v" }, "k", "gk", { desc = "Move up through wrapped lines" })

