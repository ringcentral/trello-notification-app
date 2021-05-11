const filtersGroupByCategory = [
  {
    id: 'boards_and_lists',
    name: 'Boards & Lists',
    items: [
      {
        name: 'List Created',
        id: 'createList',
        actionType: 'createList',
      },
      {
        name: 'List Archived/Unarchived',
        id: 'archiveUnarchiveList',
        actionType: 'updateList',
        actionList: ['action_archived_list', 'action_sent_list_to_board'],
      },
      {
        name: 'List Renamed',
        id: 'renameList',
        actionType: 'updateList',
        actionList: ['action_renamed_list'],
      },
      {
        name: 'Board Renamed',
        id: 'renameBoard',
        actionType: 'updateBoard',
        actionList: ['action_update_board_name'],
      },
      {
        name: 'List Moved to Another Board',
        id: 'moveListFromBoard',
        actionType: 'moveListFromBoard',
      },
      {
        name: 'Member Added to Board',
        id: 'addMemberToBoard',
        actionType: 'addMemberToBoard',
      },
    ]
  },
  {
    id: 'cards',
    name: 'Cards',
    items: [
      {
        name: 'Card Created',
        id: 'createCard',
        actionType: 'createCard',
      },
      {
        name: 'Description Changed',
        id: 'changeCardDescription',
        actionType: 'updateCard',
        actionList: ['action_changed_description_of_card'],
      },
      {
        name: 'Card Moved',
        id: 'moveCard',
        actionType: 'updateCard',
        actionList: ['action_move_card_from_list_to_list'],
      },
      {
        name: 'Due Date Changed',
        id: 'changeCardDueDate',
        actionType: 'updateCard',
        actionList: ['action_added_a_due_date', 'action_changed_a_due_date'],
      },
      {
        name: 'Card Renamed',
        id: 'renameCard',
        actionType: 'updateCard',
        actionList: ['action_renamed_card'],
      },
      {
        name: 'Member Added to Card',
        id: 'addMemberToCard',
        actionType: 'addMemberToCard',
      },
      {
        name: 'Comment Added to Card',
        id: 'commentCard',
        actionType: 'commentCard',
      },
      {
        name: 'Card Archived/Unarchived',
        id: 'archiveUnarchiveCard',
        actionType: 'updateCard',
        actionList: ['action_archived_card', 'action_sent_card_to_board'],
      },
      {
        name: 'Attachment Added to Card',
        id: 'addAttachmentToCard',
        actionType: 'addAttachmentToCard',
      },
    ],
  },
  {
    id: 'checklists',
    name: 'Checklists',
    items: [
      {
        name: 'Checklist Added to Card',
        id: 'addChecklistToCard',
        actionType: 'addChecklistToCard',
      },
      {
        name: 'Checklist Item Marked Complete/Incomplete',
        id: 'updateCheckItemStateOnCard',
        actionType: 'updateCheckItemStateOnCard',
        actionList: ['action_completed_checkitem', 'action_marked_checkitem_incomplete'],
      },
      {
        name: 'Checklist Item Created',
        id: 'createCheckItem',
        actionType: 'createCheckItem',
      }
    ],
  }
];

const filters = filtersGroupByCategory.reduce((value, current) => {
  return value.concat(current.items);
}, []);

exports.filtersGroupByCategory = filtersGroupByCategory;
exports.filters = filters;
