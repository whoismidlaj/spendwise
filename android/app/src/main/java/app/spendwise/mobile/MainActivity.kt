package app.spendwise.mobile

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.spendwise.mobile.data.Account
import app.spendwise.mobile.data.ApiClient
import app.spendwise.mobile.data.Transaction
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { SpendwiseApp(ApiClient(this)) }
    }
}

class SpendwiseViewModel(private val api: ApiClient) : ViewModel() {
    var loggedIn by mutableStateOf(api.token != null); private set
    var accounts by mutableStateOf(emptyList<Account>()); private set
    var transactions by mutableStateOf(emptyList<Transaction>()); private set
    var loading by mutableStateOf(false); private set
    var error by mutableStateOf<String?>(null); private set

    fun login(email: String, password: String) = run { loading = true; error = null; viewModelScope.launch(Dispatchers.IO) {
        try { api.login(email, password); withContext(Dispatchers.Main) { loggedIn = true; load() } }
        catch (e: Exception) { withContext(Dispatchers.Main) { error = e.message; loading = false } }
    } }

    fun load() { viewModelScope.launch(Dispatchers.IO) { try { val a = api.accounts(); val t = api.transactions(); withContext(Dispatchers.Main) { accounts = a; transactions = t; loading = false } } catch (e: Exception) { withContext(Dispatchers.Main) { error = e.message; loading = false } } } }
    fun addExpense(amount: Double, name: String, date: String, accountId: String) { viewModelScope.launch(Dispatchers.IO) { try { api.addExpense(amount, name, date, accountId); load() } catch (e: Exception) { withContext(Dispatchers.Main) { error = e.message } } } }
    fun logout() { api.logout(); loggedIn = false; accounts = emptyList(); transactions = emptyList() }
}

@Composable
fun SpendwiseApp(api: ApiClient) {
    val model: SpendwiseViewModel = viewModel { SpendwiseViewModel(api) }
    MaterialTheme { if (model.loggedIn) Dashboard(model) else Login(model) }
}

@Composable
fun Login(model: SpendwiseViewModel) {
    var email by remember { mutableStateOf("") }; var password by remember { mutableStateOf("") }
    Column(Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.Center) {
        Text("Spendwise", style = MaterialTheme.typography.headlineLarge)
        Text("Your personal finance tracker", color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(28.dp))
        OutlinedTextField(email, { email = it }, label = { Text("Email") }, modifier = Modifier.fillMaxWidth())
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(password, { password = it }, label = { Text("Password") }, modifier = Modifier.fillMaxWidth())
        Spacer(Modifier.height(16.dp))
        model.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        Button(onClick = { model.login(email, password) }, enabled = !model.loading && email.isNotBlank() && password.isNotBlank(), modifier = Modifier.fillMaxWidth()) { Text(if (model.loading) "Signing in…" else "Sign in") }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun Dashboard(model: SpendwiseViewModel) {
    var showAdd by remember { mutableStateOf(false) }
    androidx.compose.runtime.LaunchedEffect(Unit) { model.load() }
    Scaffold(topBar = { TopAppBar(title = { Text("Spendwise") }, actions = { OutlinedButton(onClick = model::logout) { Text("Log out") } }) }) { padding ->
        Column(Modifier.padding(padding).padding(horizontal = 16.dp)) {
            Spacer(Modifier.height(12.dp)); Button(onClick = { showAdd = true }, modifier = Modifier.fillMaxWidth()) { Text("Add transaction") }; Spacer(Modifier.height(16.dp))
            Text("Accounts", style = MaterialTheme.typography.titleLarge)
            model.accounts.forEach { account -> Card(Modifier.fillMaxWidth().padding(vertical = 4.dp)) { Row(Modifier.padding(16.dp), horizontalArrangement = Arrangement.SpaceBetween) { Text(account.name); Text("%.2f".format(account.balance)) } } }
            Spacer(Modifier.height(16.dp)); Text("Recent transactions", style = MaterialTheme.typography.titleLarge)
            LazyColumn { items(model.transactions) { transaction -> Row(Modifier.fillMaxWidth().padding(vertical = 10.dp), horizontalArrangement = Arrangement.SpaceBetween) { Column { Text(transaction.name); Text("${transaction.date} · ${transaction.accountName ?: "Card"}", color = MaterialTheme.colorScheme.onSurfaceVariant) }; Text("${if (transaction.type == "EXPENSE") "−" else "+"} %.2f".format(transaction.amount)) } } }
        }
    }
    if (showAdd) AddExpense(model, onClose = { showAdd = false })
}

@Composable
fun AddExpense(model: SpendwiseViewModel, onClose: () -> Unit) {
    var name by remember { mutableStateOf("") }; var amount by remember { mutableStateOf("") }; var account by remember { mutableStateOf("") }
    Card(Modifier.fillMaxWidth().padding(24.dp)) { Column(Modifier.padding(20.dp)) { Text("New expense", style = MaterialTheme.typography.titleLarge); Spacer(Modifier.height(12.dp)); OutlinedTextField(name, { name = it }, label = { Text("What did you pay for?") }, modifier = Modifier.fillMaxWidth()); OutlinedTextField(amount, { amount = it }, label = { Text("Amount") }, modifier = Modifier.fillMaxWidth()); OutlinedTextField(account, { account = it }, label = { Text("Account ID") }, modifier = Modifier.fillMaxWidth()); Spacer(Modifier.height(12.dp)); Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { OutlinedButton(onClick = onClose) { Text("Cancel") }; Button(onClick = { model.addExpense(amount.toDoubleOrNull() ?: 0.0, name, java.time.LocalDate.now().toString(), account); onClose() }, enabled = name.isNotBlank() && (amount.toDoubleOrNull() ?: 0.0) > 0 && account.isNotBlank()) { Text("Save") } } } }
}
