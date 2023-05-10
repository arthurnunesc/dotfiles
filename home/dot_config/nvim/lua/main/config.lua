-- Mimic default Vim spacing
vim.opt.tabstop = 4
vim.opt.shiftwidth = 4
vim.opt.expandtab = false

-- Persist undo history between sessions
vim.opt.undofile = true

vim.cmd('syntax on')
vim.opt.number = true
vim.opt.relativenumber = true

-- Time in milliseconds between writing swap files or triggering the
-- CursorHold autocommand
vim.opt.updatetime = 250
