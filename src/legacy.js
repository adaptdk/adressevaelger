import { AdresseSearchAPI } from "./api.js";

// Minimum number of characters before an address search is triggered
const MIN_SEARCH_LENGTH = 2;

export function adressevaelger(element, options) {
  new AdresseSearchUI(element, options);
}

export class AdresseSearchUI {
  searchType = "adresser";
  options;
  wrapperElement;
  inputElement;
  listElement;
  api;

  constructor(element, options) {
    this.options = options;
    this.searchType = options.adgangsadresserOnly ? "husnumre" : "adresser";
    this.inputElement = element;
    this.listElement = document.createElement("div");
    this.wrapperElement = this.inputElement.parentNode;
    this.wrapperElement.append(this.listElement);
    this.inputElement.addEventListener(
      "input",
      this.refreshFromInput.bind(this),
    );
    this.inputElement.addEventListener(
      "click",
      this.refreshFromInput.bind(this),
    );
    this.wrapperElement.addEventListener(
      "keydown",
      this.listKeyHandler.bind(this),
    );
    document.addEventListener("click", this.outsideClickHandler.bind(this));
    const opt = this.options.apiUrl
      ? { token: options.token, apiUrl: this.options.apiUrl }
      : { token: options.token };
    this.api = new AdresseSearchAPI(opt);
  }

  // Search from the input's current value once it has at least
  // MIN_SEARCH_LENGTH characters, otherwise close the suggestion list.
  refreshFromInput() {
    if (this.inputElement.value.length >= MIN_SEARCH_LENGTH) {
      this.refreshList(this.inputElement.value);
    } else {
      this.closeList();
    }
  }

  closeList() {
    this.listElement.querySelector("ul")?.remove();
  }

  async refreshList(queryText) {
    try {
      const data = await this.api.search(
        this.searchType,
        queryText,
        this.options,
      );
      this.renderDOMList(this.listElement, data);
    } catch (err) {
      this.errorHandler(
        new Error(`Failed to load search items: ${err.message}`),
      );
    }
  }

  renderDOMList(parentElement, items) {
    const ulEl = document.createElement("ul");
    ulEl.className = "adressevaelger-suggestions";
    ulEl.role = "listbox";
    ulEl.ariaLabel = "Søgeresultater";
    items.forEach((item) => {
      this.renderDOMListItem(ulEl, item);
    });
    this.closeList();
    parentElement.append(ulEl);

    // Highlight the first result so Enter/Tab can select it without arrow-keying first
    ulEl.querySelector("li")?.classList.add("dawa-selected");
  }

  renderDOMListItem(parentElement, item) {
    const liEl = document.createElement("li");
    liEl.className = "adressevaelger-suggestion";
    liEl.role = "option";
    liEl.tabIndex = 0;
    liEl.dataset.item = JSON.stringify(item);
    liEl.addEventListener("click", (event) => {
      this.selectProcessor(JSON.parse(event.target.dataset.item));
    });
    liEl.innerText = item.titel;
    parentElement.append(liEl);
  }

  errorHandler(err) {
    console.error(err);
    this.inputElement.dispatchEvent(
      new CustomEvent("address:error", {
        bubbles: true,
        composed: true,
        detail: { message: err.message },
      }),
    );
  }

  // Handle keyboard interaction while the suggestion list is open
  listKeyHandler(event) {
    const list = this.listElement.querySelector("ul");
    const selected = this.listElement.querySelector("li.dawa-selected");

    if (list) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        this.moveFocus(1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        this.moveFocus(-1);
      } else if (event.key === "Enter" || event.key === "Tab") {
        if (selected) {
          event.preventDefault();
          this.selectProcessor(JSON.parse(selected.dataset.item));
        }
      } else if (event.key === "Escape") {
        this.closeList();
      }
    }
  }

  outsideClickHandler(event) {
    if (!this.wrapperElement.contains(event.target)) {
      this.closeList();
    }
  }

  // Move the highlighted suggestion one step up or down.
  moveFocus(direction) {
    const items = [...this.listElement.querySelectorAll("li")];

    if (!items.length) {
      return;
    }

    const currentIndex = items.findIndex((item) =>
      item.classList.contains("dawa-selected"),
    );

    const nextIndex = Math.min(
      Math.max(currentIndex + direction, 0),
      items.length - 1,
    );

    items[currentIndex]?.classList.remove("dawa-selected");
    items[nextIndex].classList.add("dawa-selected");
    items[nextIndex].scrollIntoView({ block: "nearest" });
  }

  selectProcessor(item) {
    if (
      item.type === "vejnavn" ||
      item.type === "navngivenvejpostnummer" ||
      (item.type === "husnummer" && this.searchType === "adresser")
    ) {
      this.inputElement.value = item.titel;
      this.refreshList(item.titel);
    } else {
      this.closeList();
      this.selectItem(item);
    }
  }

  async selectItem(item) {
    try {
      const data = await this.api.get(this.searchType, item.id);
      this.inputElement.value = item.titel;
      this.inputElement.dispatchEvent(
        new CustomEvent("address:select", {
          bubbles: true,
          composed: true,
          detail: data,
        }),
      );
      this.options.select(data);
    } catch (err) {
      this.errorHandler(new Error(`Failed to fetch items: ${err.message}`));
    }
  }
}
