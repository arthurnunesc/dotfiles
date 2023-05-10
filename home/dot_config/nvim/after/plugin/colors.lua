local status, rose_pine = pcall(require, "rose-pine")
if not status then
  return
end

rose_pine.setup({
  disable_italics = true,
  disable_float_background = true
})

vim.cmd.colorscheme("rose-pine")
