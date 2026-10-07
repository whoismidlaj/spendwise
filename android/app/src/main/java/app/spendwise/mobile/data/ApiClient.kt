package app.spendwise.mobile.data

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class ApiClient(context: Context) {
    private val preferences = context.getSharedPreferences("spendwise", Context.MODE_PRIVATE)
    // Local development: adb reverse forwards the phone's localhost:3000 to the host.
    // Use HTTPS and a BuildConfig value before publishing a release build.
    private val baseUrl = "http://127.0.0.1:3000"

    var token: String?
        get() = preferences.getString("token", null)
        private set(value) { preferences.edit().putString("token", value).apply() }

    fun logout() { preferences.edit().remove("token").apply() }

    fun login(email: String, password: String): LoginResult {
        val body = request("/api/mobile/auth/login", "POST", JSONObject().apply {
            put("email", email); put("password", password)
        })
        val userJson = body.getJSONObject("user")
        token = body.getString("token")
        return LoginResult(token!!, User(userJson.getString("id"), userJson.optString("name").takeIf { it.isNotBlank() }, userJson.getString("email"), userJson.getString("currency")))
    }

    fun accounts(): List<Account> {
        val array = requestArray("/api/accounts")
        return (0 until array.length()).map { item ->
            val json = array.getJSONObject(item)
            Account(json.getString("id"), json.getString("name"), json.getString("type"), json.getDouble("balance"))
        }
    }

    fun transactions(): List<Transaction> {
        val array = request("/api/transactions?limit=50").getJSONArray("transactions")
        return (0 until array.length()).map { item ->
            val json = array.getJSONObject(item)
            Transaction(json.getString("id"), json.getString("name"), json.getDouble("amount"), json.getString("type"), json.getString("date").take(10), json.optJSONObject("account")?.optString("name"))
        }
    }

    private fun request(path: String, method: String = "GET", body: JSONObject? = null): JSONObject {
        val connection = open(path, method)
        body?.let { connection.outputStream.use { stream -> stream.write(it.toString().toByteArray()) } }
        return read(connection).let(::JSONObject)
    }

    private fun requestArray(path: String): JSONArray {
        val connection = open(path, "GET")
        return JSONArray(read(connection))
    }

    private fun open(path: String, method: String): HttpURLConnection {
        val connection = URL(baseUrl + path).openConnection() as HttpURLConnection
        connection.requestMethod = method
        connection.setRequestProperty("Accept", "application/json")
        token?.let { connection.setRequestProperty("Authorization", "Bearer $it") }
        if (method != "GET") {
            connection.doOutput = true
            connection.setRequestProperty("Content-Type", "application/json")
        }
        return connection
    }

    private fun read(connection: HttpURLConnection): String {
        val stream = if (connection.responseCode in 200..299) connection.inputStream else connection.errorStream
        val text = stream.bufferedReader().use { it.readText() }
        if (connection.responseCode !in 200..299) throw IllegalStateException(JSONObject(text).optString("error", "Request failed"))
        return text
    }
}
