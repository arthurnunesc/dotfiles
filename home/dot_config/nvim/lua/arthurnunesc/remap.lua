vim.g.mapleader = " "
vim.keymap.set("n", "<leader>fm", vim.cmd.Ex)

vim.cmd[[
  vnoremap <C-S-c> "*y :let @+=@*<CR>
  map <C-S-v> "+P
  map <C-a> ggVG
]]
