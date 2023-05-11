local status, rose_pine = pcall(require, "rose-pine")
if not status then
  return
end

rose_pine.setup({
  disable_italics = false,
  disable_float_background = true
})

vim.opt.termguicolors = true
vim.cmd.colorscheme("rose-pine")
