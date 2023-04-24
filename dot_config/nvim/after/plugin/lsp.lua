local mason_status, mason = pcall(require, "mason")
local mason_lspconfig_status, mason_lspconfig = pcall(require, "mason-lspconfig")
local lspconfig_status, lspconfig = pcall(require, "lspconfig")
local status = mason_status and mason_lspconfig_status and lspconfig_status
if not status then
  return
end

mason.setup()
mason_lspconfig.setup({
  ensure_installed = { "lua_ls" }
})

local on_attach = function(_, _)
  vim.keymap.set('n', '<leader>rn', vim.lsp.buf.rename, {})
end

lspconfig.lua_ls.setup {
  on_attach = on_attach
}
