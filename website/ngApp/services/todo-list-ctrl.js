var Ally;
(function (Ally) {
    var TodoItem = /** @class */ (function () {
        function TodoItem() {
        }
        return TodoItem;
    }());
    Ally.TodoItem = TodoItem;
    var TodoList = /** @class */ (function () {
        function TodoList() {
        }
        return TodoList;
    }());
    Ally.TodoList = TodoList;
    var TodoListCtrl = /** @class */ (function () {
        /**
         * The constructor for the class
         */
        function TodoListCtrl($http) {
            this.$http = $http;
            this.todoLists = [];
            this.isLoading = false;
            this.isFixedList = false;
            this.shouldExpandTodoItemModal = false;
        }
        /**
        * Called on each controller after all the controllers on an element have been constructed
        */
        TodoListCtrl.prototype.$onInit = function () {
            this.isFixedList = !!this.fixedTodoListId;
            if (this.isFixedList)
                this.loadFixedTodoList();
            else
                this.loadAllTodoLists();
        };
        /**
         * Retrieve a todo list
         */
        TodoListCtrl.prototype.loadFixedTodoList = function () {
            var _this = this;
            this.isLoading = true;
            this.$http.get("/api/Todo/List/" + this.fixedTodoListId).then(function (httpResponse) {
                _this.isLoading = false;
                _this.todoLists = [httpResponse.data];
            });
        };
        /**
         * Retrieve the todo lists
         */
        TodoListCtrl.prototype.loadAllTodoLists = function () {
            var _this = this;
            this.isLoading = true;
            var getUri = "/api/Todo";
            if (this.committee)
                getUri = "/api/Todo/ListsForCommittee/" + this.committee.committeeId;
            this.$http.get(getUri).then(function (httpResponse) {
                _this.isLoading = false;
                _this.todoLists = httpResponse.data;
            });
        };
        /**
         * Create a new to-do list
         */
        TodoListCtrl.prototype.onAddList = function () {
            var _this = this;
            this.isLoading = true;
            var postUri = "/api/Todo/newList?listName=" + encodeURIComponent(this.newListName);
            if (this.committee)
                postUri += "&committeeId=" + this.committee.committeeId;
            this.$http.post(postUri, null).then(function () {
                _this.isLoading = false;
                _this.loadAllTodoLists();
            });
        };
        /**
         * Create a new to-do item
         */
        TodoListCtrl.prototype.onAddItem = function (todoListId) {
            var _this = this;
            this.isLoading = true;
            var postUri = "/api/Todo/newItem/" + todoListId + "?description=" + encodeURIComponent(this.newItemDescription);
            this.$http.post(postUri, null).then(function (response) {
                _this.isLoading = false;
                _this.newItemDescription = "";
                _this.loadAllTodoLists();
            });
        };
        /**
         * Create a new to-do
         */
        TodoListCtrl.prototype.addNewItem = function (todoListId) {
            this.editTodoItem = new TodoItem();
            this.editTodoItem.owningTodoListId = todoListId;
            if (this.committee)
                this.editTodoItem.owningTodoListId = todoListId;
            this.shouldExpandTodoItemModal = false;
            window.setTimeout(function () { return $("#edit-todo-name-text-box").focus(); }, 100);
        };
        /**
         * Save changes to a to-do item
         */
        TodoListCtrl.prototype.saveTodoItem = function () {
            var _this = this;
            this.isLoading = true;
            var postUri = "/api/Todo/Item";
            this.$http.post(postUri, this.editTodoItem).then(function (response) {
                _this.isLoading = false;
                _this.newItemDescription = "";
                _this.editTodoItem = null;
                _this.loadAllTodoLists();
            });
        };
        /**
         * Toggle an item's completed state
         */
        TodoListCtrl.prototype.onToggleComplete = function (todoListId, todoItemId) {
            var _this = this;
            this.isLoading = true;
            this.$http.put("/api/Todo/toggleComplete/" + todoListId + "/" + todoItemId, null).then(function (response) {
                _this.isLoading = false;
                _this.loadAllTodoLists();
            });
        };
        TodoListCtrl.$inject = ["$http"];
        return TodoListCtrl;
    }());
    Ally.TodoListCtrl = TodoListCtrl;
})(Ally || (Ally = {}));
CA.angularApp.component("todoList", {
    bindings: {
        fixedTodoListId: "<?",
        committee: "<?"
    },
    templateUrl: "/ngApp/services/todo-list.html",
    controller: Ally.TodoListCtrl
});
