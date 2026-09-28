package app.spendwise.mobile.data

data class User(val id: String, val name: String?, val email: String, val currency: String)
data class LoginResult(val token: String, val user: User)
data class Account(val id: String, val name: String, val type: String, val balance: Double)
data class Transaction(
    val id: String,
    val name: String,
    val amount: Double,
    val type: String,
    val date: String,
    val accountName: String?
)
