from weni import Tool
from weni.context import Context
from weni.responses import TextResponse
import requests


class BuscarProduto(Tool):
    def execute(self, context: Context) -> TextResponse:
        termo_busca = context.parameters.get("termo_busca", "")
        if not termo_busca:
            return TextResponse(data={"error": "Termo de busca é obrigatório"})

        print(termo_busca)

        produtos = self.buscar_produto_vtex(termo_busca)
        return TextResponse(data=produtos)

    def buscar_produto_vtex(self, termo_busca: str):
        base_url = "https://api.vtex.com/{accountName}/products/search"
        account_name = context.credentials.get("account_name")
        url = base_url.format(accountName=account_name) + f"?_keyword={termo_busca}"
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "X-VTEX-API-AppKey": context.credentials.get("app_key"),
            "X-VTEX-API-AppToken": context.credentials.get("app_token")
        }
        response = requests.get(url, headers=headers)
        return response.json()