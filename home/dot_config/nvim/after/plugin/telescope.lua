local status, builtin = pcall(require, "telescope.builtin")
if not status then
  return
end

-- Search for file by name in base directory
vim.keymap.set("n", "<leader>ff", builtin.find_files, {})
-- Search for file by name between git files
vim.keymap.set("n", "<leader>gf", builtin.git_files, {})
-- Grep for string in base directory
vim.keymap.set("n", "<leader>grep", function()
	builtin.grep_string({ search = vim.fn.input("Grep > ") });
end)
